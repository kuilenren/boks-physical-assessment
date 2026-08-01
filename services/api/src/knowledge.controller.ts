import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import {
  knowledgeSourceRequestSchema,
  knowledgeVersionRequestSchema,
} from "@boks/contracts";
import { persistStore, store } from "./demo-store.js";
import { success } from "./http.js";
import { parseInput } from "./validation.js";
import { resourceNotFound } from "./auth.js";
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
@Controller("knowledge")
export class KnowledgeController {
  @Get() list() {
    return success(
      Object.values(store.knowledgeVersions).filter(
        (item) => item.status === "published",
      ),
    );
  }
  @Get("audit")
  audit(@Req() request: Request) {
    admin(request);
    return success(store.auditEvents);
  }
  @Post("sources") source(@Body() body: unknown, @Req() request: Request) {
    const actor = admin(request);
    const input = parseInput(knowledgeSourceRequestSchema, body);
    const item = {
      id: randomUUID(),
      ...input,
      created_at: new Date().toISOString(),
    };
    store.knowledgeSources[item.id] = item;
    store.auditEvents.push({
      id: randomUUID(),
      action: "knowledge.source",
      actor,
      created_at: new Date().toISOString(),
    });
    void persistStore();
    return success(item);
  }
  @Post("versions") version(@Body() body: unknown, @Req() request: Request) {
    const actor = admin(request);
    const input = parseInput(knowledgeVersionRequestSchema, body);
    if (!store.knowledgeSources[input.source_id])
      resourceNotFound("KNOWLEDGE_SOURCE_NOT_FOUND", "来源不存在。");
    const item = {
      id: randomUUID(),
      ...input,
      status: "candidate" as const,
      reviewers: [actor],
      published_at: null,
    };
    store.knowledgeVersions[item.id] = item;
    void persistStore();
    return success(item);
  }
  @Post("versions/:id/review") review(
    @Param("id") id: string,
    @Req() request: Request,
  ) {
    const actor = admin(request);
    const item = store.knowledgeVersions[id];
    if (!item)
      resourceNotFound("KNOWLEDGE_VERSION_NOT_FOUND", "知识版本不存在。");
    if (!item.reviewers.includes(actor)) item.reviewers.push(actor);
    store.auditEvents.push({
      id: randomUUID(),
      action: "knowledge.review",
      actor,
      created_at: new Date().toISOString(),
    });
    void persistStore();
    return success(item);
  }
  @Post("versions/:id/publish") publish(
    @Param("id") id: string,
    @Req() request: Request,
  ) {
    const actor = admin(request);
    const item = store.knowledgeVersions[id];
    if (!item)
      resourceNotFound("KNOWLEDGE_VERSION_NOT_FOUND", "知识版本不存在。");
    if (!item.reviewers.includes(actor)) item.reviewers.push(actor);
    if (new Set(item.reviewers).size < 2)
      throw new ForbiddenException({
        error: {
          code: "TWO_REVIEWERS_REQUIRED",
          message: "发布至少需要两名不同审核者。",
          details: [],
          retryable: false,
        },
      });
    item.status = "published";
    item.published_at = new Date().toISOString();
    store.auditEvents.push({
      id: randomUUID(),
      action: "knowledge.publish",
      actor,
      created_at: new Date().toISOString(),
    });
    void persistStore();
    return success(item);
  }
  @Post("versions/:id/withdraw") withdraw(
    @Param("id") id: string,
    @Req() request: Request,
  ) {
    const actor = admin(request);
    const item = store.knowledgeVersions[id];
    if (!item)
      resourceNotFound("KNOWLEDGE_VERSION_NOT_FOUND", "知识版本不存在。");
    item.status = "withdrawn";
    store.auditEvents.push({
      id: randomUUID(),
      action: "knowledge.withdraw",
      actor,
      created_at: new Date().toISOString(),
    });
    void persistStore();
    return success(item);
  }
}
