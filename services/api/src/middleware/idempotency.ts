/**
 * 幂等键中间件（POST/PATCH/DELETE）
 * - 客户端通过 Idempotency-Key 提供（24h 内同 key 同 payload 返回缓存响应）
 * - Redis 主，PG 兜底（重启不丢）
 * - key 不一致 → 409 IDEMPOTENCY_KEY_MISMATCH
 */
import type { Request, Response, NextFunction } from "express";
import { sha256Hex } from "../security/kms.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { getRedis } from "../redis/client.js";
import { Pool } from "pg";

const TTL_SECONDS = 24 * 3600;
const KEY_PREFIX = "idem:";

function redisKey(k: string): string {
  return `${KEY_PREFIX}${k}`;
}

async function loadFromRedis(keyHash: string): Promise<{ status: number; body: unknown } | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (await getRedis()) as any;
  if (!c) return undefined;
  try {
    const raw = await c.get(redisKey(keyHash));
    return raw ? (JSON.parse(raw) as { status: number; body: unknown }) : undefined;
  } catch {
    return undefined;
  }
}

async function saveToRedis(keyHash: string, status: number, body: unknown): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (await getRedis()) as any;
  if (!c) return;
  try {
    await c.set(redisKey(keyHash), JSON.stringify({ status, body }), { EX: TTL_SECONDS });
  } catch {
    // ignore
  }
}

async function loadFromPg(pool: Pool, keyHash: string): Promise<{ status: number; body: unknown } | undefined> {
  const { rows } = await pool.query<{ response_status: number; response_body: unknown }>(
    `SELECT response_status, response_body FROM boks.boks_idempotency_keys
     WHERE key_hash = $1 AND expires_at > NOW()`,
    [keyHash],
  );
  return rows[0]
    ? { status: rows[0].response_status, body: rows[0].response_body }
    : undefined;
}

async function saveToPg(pool: Pool, keyHash: string, route: string, method: string, requestHash: string, status: number, body: unknown): Promise<void> {
  await pool.query(
    `INSERT INTO boks.boks_idempotency_keys
       (key_hash, method, route, request_hash, response_status, response_body, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6, NOW() + ($7 || ' seconds')::interval)
     ON CONFLICT (key_hash) DO NOTHING`,
    [keyHash, method, route, requestHash, status, body, String(TTL_SECONDS)],
  );
}

let pool: Pool | undefined;
export function setIdempotencyPool(p: Pool): void {
  pool = p;
}

export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const method = req.method;
  if (method !== "POST" && method !== "PATCH" && method !== "DELETE" && method !== "PUT") {
    next();
    return;
  }
  const key = req.header("idempotency-key");
  if (!key) {
    next();
    return;
  }
  const route = `${method} ${req.baseUrl}${req.path}`;
  const payloadRaw = req.body ? JSON.stringify(req.body) : "";
  const requestHash = sha256Hex(payloadRaw);
  const keyHash = sha256Hex(`${key}|${route}|${requestHash}`);

  // 检查一致性（防止同 key 不同 payload）
  const cacheKeyOnly = sha256Hex(`${key}|${route}`);
  if (pool) {
    const { rows } = await pool.query<{ request_hash: string }>(
      `SELECT request_hash FROM boks.boks_idempotency_keys WHERE key_hash = $1 LIMIT 1`,
      [cacheKeyOnly],
    );
    if (rows[0] && rows[0].request_hash !== requestHash) {
      res.status(409).json({
        error: {
          code: "IDEMPOTENCY_KEY_MISMATCH",
          message: "Idempotency-Key 已被使用且 payload 不一致。",
          details: [],
          retryable: false,
        },
        meta: { trace_id: req.header("x-trace-id"), request_id: "" },
      });
      return;
    }
  }

  const cached = (await loadFromRedis(cacheKeyOnly)) ?? (pool ? await loadFromPg(pool, cacheKeyOnly) : undefined);
  if (cached) {
    res.status(cached.status).json(cached.body);
    return;
  }

  // 拦截 res.json 以缓存响应
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    void saveToRedis(cacheKeyOnly, res.statusCode, body);
    if (pool) void saveToPg(pool, cacheKeyOnly, route, method, requestHash, res.statusCode, body);
    if (process.env.BOKS_DEBUG_IDEMPOTENCY === "true") {
      // eslint-disable-next-line no-console
      console.warn(`[idempotency] saved ${cacheKeyOnly} status=${res.statusCode}`);
    }
    return originalJson(body);
  }) as typeof res.json;

  next();
}