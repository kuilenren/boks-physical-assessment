/**
 * Redis 客户端（连接池 + 重试 + 错误降级）
 * 生产：Redis 7+（Sentinel/Cluster 可选）
 * 本地：localhost:6379（已在 docker compose 中）
 * 注意：所有 Redis 错误必须降级，不阻塞主流程（限流/缓存失败 → 允许通过）
 */
// 使用 require 避免 strict 编译期类型问题（运行时安装 redis 后生效）
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const { createClient } = require("redis") as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any;

function url(): string {
  return process.env.BOKS_REDIS_URL ?? "redis://localhost:6379";
}

export async function getRedis(): Promise<unknown | undefined> {
  if (client && client.isReady) return client;
  const c = createClient({
    url: url(),
    socket: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reconnectStrategy: (retries: number) => Math.min(1000 * 2 ** retries, 15_000),
      connectTimeout: 3_000,
    },
  });
  c.on("error", (e: Error) => {
    // eslint-disable-next-line no-console
    console.warn(`[redis] error: ${e.message}`);
  });
  try {
    await c.connect();
    client = c;
    return client;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[redis] connect failed: ${(e as Error).message}; falling back to no-op`);
    return undefined;
  }
}

export async function closeRedis(): Promise<void> {
  if (client) {
    try {
      await client.quit();
    } catch {
      // ignore
    }
    client = undefined;
  }
}

/** 令牌桶限流（Redis Lua 原子） */
const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local rate = tonumber(ARGV[1])         -- 每秒补充 token 数
local capacity = tonumber(ARGV[2])     -- 桶容量
local now = tonumber(ARGV[3])          -- ms
local requested = tonumber(ARGV[4])    -- 本次消费 1
local ttl_ms = tonumber(ARGV[5])       -- key 过期 ms
local bucket = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(bucket[1]) or capacity
local ts = tonumber(bucket[2]) or now
local delta = math.max(0, now - ts)
tokens = math.min(capacity, tokens + delta * rate / 1000)
local allowed = 0
if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
end
redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', key, ttl_ms)
return { allowed, math.floor(tokens) }
`;

export async function tokenBucket(opts: {
  key: string;
  ratePerSecond: number;
  capacity: number;
  now?: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (await getRedis()) as any;
  const now = opts.now ?? Date.now();
  if (!c) return { allowed: true, remaining: opts.capacity }; // 降级：允许通过
  try {
    const r = (await c.eval(TOKEN_BUCKET_LUA, {
      keys: [opts.key],
      arguments: [
        String(opts.ratePerSecond),
        String(opts.capacity),
        String(now),
        "1",
        String(Math.max(60_000, Math.ceil((opts.capacity / opts.ratePerSecond) * 2000))),
      ],
    })) as [number, number];
    return { allowed: r[0] === 1, remaining: r[1] };
  } catch {
    return { allowed: true, remaining: opts.capacity };
  }
}

/** 固定窗口计数（兜底） */
export async function fixedWindow(opts: {
  key: string;
  windowSeconds: number;
  limit: number;
}): Promise<{ allowed: boolean; count: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (await getRedis()) as any;
  if (!c) return { allowed: true, count: 0 };
  try {
    const count = await c.incr(opts.key);
    if (count === 1) await c.expire(opts.key, opts.windowSeconds);
    return { allowed: count <= opts.limit, count };
  } catch {
    return { allowed: true, count: 0 };
  }
}