import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import {
  findStandard,
  getConfiguration,
  persistStore,
  store,
  type StandardConfiguration,
} from "./demo-store.js";
import { success } from "./http.js";
import { resourceNotFound } from "./auth.js";
function parseStandard(body: unknown): StandardConfiguration {
  if (typeof body !== "object" || body === null)
    throw new BadRequestException({
      error: {
        code: "INVALID_CONFIGURATION",
        message: "配置格式不符合要求。",
        details: [],
        retryable: false,
      },
    });
  const candidate = body as Partial<StandardConfiguration>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    !Array.isArray(candidate.indicators) ||
    !Array.isArray(candidate.rules)
  )
    throw new BadRequestException({
      error: {
        code: "INVALID_CONFIGURATION",
        message: "配置格式不符合要求。",
        details: [],
        retryable: false,
      },
    });
  return candidate as StandardConfiguration;
}
function admin(request: Request): string {
  const configured = process.env.BOKS_ADMIN_TOKEN;
  const token = request.headers["x-admin-token"];
  if (configured ? token !== configured : token !== "dev-admin-token")
    throw new UnauthorizedException({
      error: {
        code: "ADMIN_TOKEN_REQUIRED",
        message: "需要后台令牌；本地未配置时可使用 dev-admin-token。",
        details: [],
        retryable: false,
      },
    });
  return typeof request.headers["x-admin-reviewer"] === "string"
    ? request.headers["x-admin-reviewer"]
    : typeof token === "string"
      ? token
      : "dev-admin-token";
}
@Controller("configuration")
export class ConfigurationController {
  @Get("assessment") getAssessmentConfiguration(
    @Headers("x-trace-id") traceId?: string,
  ) {
    return success(getConfiguration(), traceId);
  }
  @Patch("assessment") update(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const actor = admin(request);
    const candidate = parseStandard(body);
    store.configuration.candidates = [
      ...store.configuration.candidates.filter(
        (item) => item.id !== candidate.id,
      ),
      candidate,
    ];
    store.auditEvents.push({
      id: randomUUID(),
      action: "configuration.candidate",
      actor,
      created_at: new Date().toISOString(),
    });
    void persistStore();
    return success(candidate, traceId);
  }
  @Post("assessment/candidates/:id/publish") publish(
    @Param("id") id: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const actor = admin(request);
    const candidate = store.configuration.candidates.find(
      (item) => item.id === id,
    );
    if (!candidate)
      resourceNotFound("CONFIGURATION_NOT_FOUND", "候选配置不存在。");
    store.configuration.history.push(
      ...store.configuration.standards.filter((item) => item.id === id),
    );
    store.configuration.standards = [
      ...store.configuration.standards.filter((item) => item.id !== id),
      candidate,
    ];
    store.configuration.active_standard_id = candidate.id;
    store.configuration.candidates = store.configuration.candidates.filter(
      (item) => item.id !== id,
    );
    store.auditEvents.push({
      id: randomUUID(),
      action: "configuration.publish",
      actor,
      created_at: new Date().toISOString(),
    });
    void persistStore();
    return success(candidate, traceId);
  }
  @Post("assessment/:id/rollback") rollback(
    @Param("id") id: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    admin(request);
    const item = findStandard(id);
    if (!item) resourceNotFound("CONFIGURATION_NOT_FOUND", "配置不存在。");
    store.configuration.active_standard_id = item.id;
    void persistStore();
    return success(item, traceId);
  }
}
