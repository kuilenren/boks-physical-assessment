import {
  Catch,
  ArgumentsHost,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";

@Catch()
export class RequestExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const traceId =
      (request.headers["x-trace-id"] as string | undefined) ?? randomUUID();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const body =
      exception instanceof HttpException ? exception.getResponse() : null;
    const input =
      typeof body === "object" && body !== null
        ? (body as {
            error?: {
              code?: string;
              message?: string;
              details?: Array<Record<string, string>>;
              retryable?: boolean;
            };
          })
        : {};
    const defaultCode =
      status === 400
        ? "INVALID_REQUEST"
        : status === 401
          ? "AUTH_REQUIRED"
          : status === 403
            ? "FORBIDDEN"
            : status === 404
              ? "NOT_FOUND"
              : "INTERNAL_ERROR";
    response.status(status).json({
      error: {
        code: input.error?.code ?? defaultCode,
        message:
          input.error?.message ??
          (typeof body === "string" ? body : "请求处理失败。"),
        details: input.error?.details ?? [],
        retryable: input.error?.retryable ?? status >= 500,
      },
      meta: { trace_id: traceId, request_id: randomUUID() },
    });
  }
}
