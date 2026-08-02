import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { json } from "express";
import { AppModule } from "./app.module.js";
import { randomUUID } from "node:crypto";
import { RequestExceptionFilter } from "./request.filter.js";
import type { Request, Response, NextFunction } from "express";
import { Pool } from "pg";
import { initializeStore } from "./demo-store.js";
import { isValidSessionToken } from "./auth.js";
import { startKnowledgeSyncScheduler } from "./knowledge-sync.js";
import {
  assertRuntimeConfig,
  isDevAuthEnabled,
  isProductionRuntime,
} from "./runtime-config.js";
import { seedPublishedKnowledge } from "./seed-knowledge.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { idempotencyMiddleware, setIdempotencyPool } from "./middleware/idempotency.js";
import { closeRedis } from "./redis/client.js";
import { seedExtendedFamilies } from "./seed-extended.js";

async function bootstrap() {
  assertRuntimeConfig();
  await initializeStore();
  if (!isProductionRuntime()) {
    const seedResult = seedPublishedKnowledge();
    process.stdout.write(
      `${JSON.stringify({
        event: "knowledge.seed",
        ...seedResult,
      })}\n`,
    );
    const extended = seedExtendedFamilies();
    process.stdout.write(
      `${JSON.stringify({
        event: "family.seed",
        ...extended,
      })}\n`,
    );
  }
  startKnowledgeSyncScheduler();

  // PG 连接池（用于幂等键持久化与新表）
  let pgPool: Pool | undefined;
  const pgUrl = process.env.BOKS_DATABASE_URL;
  if (pgUrl) {
    pgPool = new Pool({ connectionString: pgUrl, max: 10 });
    setIdempotencyPool(pgPool);
  }

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: "12mb" }));
  app.setGlobalPrefix("v1");
  app.use((request: Request, response: Response, next: NextFunction) => {
    const traceId = request.header("x-trace-id") ?? randomUUID();
    response.setHeader("x-trace-id", traceId);
    next();
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = Date.now();
    response.once("finish", () => {
      if (process.env.BOKS_HTTP_ACCESS_LOG === "false") return;
      process.stdout.write(
        `${JSON.stringify({
          event: "http.request",
          method: request.method,
          path: request.path,
          status: response.statusCode,
          duration_ms: Date.now() - startedAt,
          trace_id: response.getHeader("x-trace-id"),
          client_version: request.header("x-client-version") ?? null,
        })}\n`,
      );
    });
    next();
  });
  // 限流中间件（IP + family）
  app.use((req: Request, res: Response, next: NextFunction) => {
    rateLimitMiddleware(req, res, next).catch(next);
  });
  // 幂等键中间件
  app.use((req: Request, res: Response, next: NextFunction) => {
    idempotencyMiddleware(req, res, next).catch(next);
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const path = request.path;
    const publicRoute =
      path.endsWith("/health") ||
      path.endsWith("/health/ready") ||
      path.endsWith("/auth/dev-login") ||
      path.endsWith("/auth/wechat-login") ||
      path.endsWith("/auth/wechat-bind") ||
      path.endsWith("/auth/phone/request-code") ||
      path.endsWith("/auth/phone/login") ||
      path.endsWith("/auth/refresh");
    const adminRoute =
      path.startsWith("/v1/configuration") || path.startsWith("/v1/knowledge");
    if (publicRoute || adminRoute) {
      next();
      return;
    }
    if (isDevAuthEnabled()) {
      next();
      return;
    }
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
    if (!isValidSessionToken(token)) {
      response.status(401).json({
        error: {
          code: "AUTH_REQUIRED",
          message: "需要监护人登录。",
          details: [],
          retryable: false,
        },
        meta: {
          trace_id: response.getHeader("x-trace-id"),
          request_id: randomUUID(),
        },
      });
      return;
    }
    next();
  });
  app.useGlobalFilters(new RequestExceptionFilter());
  app.enableCors({
    origin:
      process.env.BOKS_CORS_ORIGIN ?? (isProductionRuntime() ? false : true),
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Admin-Token",
      "X-Admin-Reviewer",
      "X-Client-Platform",
      "X-Client-Version",
      "X-Trace-Id",
      "X-Family-Hint",
      "Idempotency-Key",
    ],
  });
  await app.listen(Number(process.env.API_PORT ?? 3000));
  process.on("SIGTERM", async () => {
    await closeRedis();
    if (pgPool) await pgPool.end();
    process.exit(0);
  });
}

void bootstrap();
