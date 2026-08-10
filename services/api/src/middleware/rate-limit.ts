/**
 * 限流中间件（基于 Redis 令牌桶）
 * - 默认策略：每 family 每秒 5 个写、50 个读；每 IP 每秒 20 个
 * - 客户端 X-Client-Version 用于版本化灰度
 * - 失败降级：Redis 不可用时放行（fail-open）
 */
import type { Request, Response, NextFunction } from "express";
import { tokenBucket } from "../redis/client.js";
import { isDevAuthEnabled } from "../runtime-config.js";
import { familyIdFromValidSession } from "../auth.js";
import { randomUUID } from "node:crypto";

const DEFAULT_WRITE_RATE = 5; // req/s per family
const DEFAULT_WRITE_CAP = 20;
const DEFAULT_READ_RATE = 50;
const DEFAULT_READ_CAP = 100;
const IP_RATE = 20;
const IP_CAP = 60;

function familyIdFromToken(req: Request): string | undefined {
  // 生产环境：familyId 只能来自已验证的会话，绝不信任客户端自报的请求头
  if (isDevAuthEnabled()) return req.header("x-family-hint");
  return familyIdFromValidSession(req);
}

function clientIp(req: Request): string {
  const fwd = req.header("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.ip ?? "unknown";
}

export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (isDevAuthEnabled() && process.env.BOKS_RATE_LIMIT_DISABLED === "true") {
    next();
    return;
  }
  const method = req.method;
  const isWrite =
    method === "POST" ||
    method === "PATCH" ||
    method === "DELETE" ||
    method === "PUT";
  const familyId = familyIdFromToken(req);
  const ip = clientIp(req);

  const ipBucket = await tokenBucket({
    key: `rl:ip:${ip}`,
    ratePerSecond: IP_RATE,
    capacity: IP_CAP,
  });
  if (!ipBucket.allowed) {
    res.setHeader("retry-after", "1");
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "请求过于频繁，请稍后重试。",
        details: [],
        retryable: true,
      },
      meta: {
        trace_id: req.header("x-trace-id") ?? randomUUID(),
        request_id: randomUUID(),
      },
    });
    return;
  }

  if (familyId) {
    const fb = await tokenBucket({
      key: `rl:family:${familyId}`,
      ratePerSecond: isWrite ? DEFAULT_WRITE_RATE : DEFAULT_READ_RATE,
      capacity: isWrite ? DEFAULT_WRITE_CAP : DEFAULT_READ_CAP,
    });
    if (!fb.allowed) {
      res.setHeader("retry-after", "1");
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "本家庭请求过于频繁，请稍后重试。",
          details: [],
          retryable: true,
        },
        meta: {
          trace_id: req.header("x-trace-id") ?? randomUUID(),
          request_id: randomUUID(),
        },
      });
      return;
    }
  }
  next();
}
