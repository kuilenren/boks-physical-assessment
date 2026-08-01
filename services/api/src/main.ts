import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { randomUUID } from "node:crypto";
import { RequestExceptionFilter } from "./request.filter.js";
import type { Request, Response, NextFunction } from "express";
import { store } from "./demo-store.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("v1");
  app.use((request: Request, response: Response, next: NextFunction) => {
    const traceId = request.header("x-trace-id") ?? randomUUID();
    response.setHeader("x-trace-id", traceId);
    next();
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const path = request.path;
    const publicRoute =
      path.endsWith("/health") ||
      path.endsWith("/auth/dev-login") ||
      path.startsWith("/v1/configuration") ||
      path.startsWith("/v1/knowledge");
    if (publicRoute || process.env.BOKS_ENABLE_DEV_AUTH !== "false") {
      next();
      return;
    }
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
    const session = store.sessions[token];
    if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
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
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Admin-Token",
      "X-Admin-Reviewer",
      "X-Client-Platform",
      "X-Client-Version",
      "X-Trace-Id",
      "Idempotency-Key",
    ],
  });
  await app.listen(Number(process.env.API_PORT ?? 3000));
}

void bootstrap();
