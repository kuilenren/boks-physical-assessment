import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  ForbiddenException,
} from "@nestjs/common";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import {
  knowledgeSourceRequestSchema,
  knowledgeVersionRequestSchema,
} from "@boks/contracts";
import {
  loadPlatformStore,
  updatePlatformStore,
  type KnowledgeVersion,
} from "./demo-store.js";
import { success } from "./http.js";
import { parseInput } from "./validation.js";
import { adminReviewer, resourceNotFound } from "./auth.js";
import {
  contentHash,
  syncAllKnowledgeSources,
} from "./knowledge-sync.js";
@Controller("knowledge")
export class KnowledgeController {
  @Get() async list(@Req() request: Request) {
    adminReviewer(request);
    const platform = await loadPlatformStore();
    return success(
      Object.values(platform.knowledgeVersions).filter(
        (item) => item.status === "published",
      ),
    );
  }
  @Get("audit")
  async audit(@Req() request: Request) {
    adminReviewer(request);
    const platform = await loadPlatformStore();
    return success(platform.auditEvents);
  }
  @Post("sources") async source(
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    const actor = adminReviewer(request);
    const input = parseInput(knowledgeSourceRequestSchema, body);
    const item = {
      id: randomUUID(),
      ...input,
      content_hash: null,
      created_at: new Date().toISOString(),
    };
    await updatePlatformStore((platform) => {
      platform.knowledgeSources[item.id] = item;
      platform.auditEvents.push({
        id: randomUUID(),
        action: "knowledge.source",
        actor,
        created_at: new Date().toISOString(),
      });
    });
    return success(item);
  }
  @Post("sync")
  async sync(@Req() request: Request) {
    adminReviewer(request);
    const results = await syncAllKnowledgeSources();
    return success(results);
  }
  @Post("versions") async version(
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    const actor = adminReviewer(request);
    const input = parseInput(knowledgeVersionRequestSchema, body);
    let item: KnowledgeVersion;
    await updatePlatformStore((platform) => {
      if (!platform.knowledgeSources[input.source_id])
        resourceNotFound("KNOWLEDGE_SOURCE_NOT_FOUND", "来源不存在。");
      item = {
        id: randomUUID(),
        ...input,
        content_hash: contentHash(input.content),
        status: "candidate" as const,
        reviewers: [actor],
        published_at: null,
        created_at: new Date().toISOString(),
      };
      platform.knowledgeVersions[item.id] = item;
    });
    return success(item!);
  }
  @Post("versions/:id/review") async review(
    @Param("id") id: string,
    @Req() request: Request,
  ) {
    const actor = adminReviewer(request);
    let updated: KnowledgeVersion;
    await updatePlatformStore((platform) => {
      const item = platform.knowledgeVersions[id];
      if (!item)
        resourceNotFound("KNOWLEDGE_VERSION_NOT_FOUND", "知识版本不存在。");
      if (!item.reviewers.includes(actor)) item.reviewers.push(actor);
      platform.auditEvents.push({
        id: randomUUID(),
        action: "knowledge.review",
        actor,
        created_at: new Date().toISOString(),
      });
      updated = item;
    });
    return success(updated!);
  }
  @Post("versions/:id/publish") async publish(
    @Param("id") id: string,
    @Req() request: Request,
  ) {
    const actor = adminReviewer(request);
    let updated: KnowledgeVersion;
    await updatePlatformStore((platform) => {
      const item = platform.knowledgeVersions[id];
      if (!item)
        resourceNotFound("KNOWLEDGE_VERSION_NOT_FOUND", "知识版本不存在。");
      if (item.status !== "candidate")
        throw new ForbiddenException({
          error: {
            code: "KNOWLEDGE_VERSION_NOT_CANDIDATE",
            message: "只有候选知识版本可以发布。",
            details: [],
            retryable: false,
          },
        });
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
      platform.auditEvents.push({
        id: randomUUID(),
        action: "knowledge.publish",
        actor,
        created_at: new Date().toISOString(),
      });
      updated = item;
    });
    return success(updated!);
  }
  @Post("versions/:id/withdraw") async withdraw(
    @Param("id") id: string,
    @Req() request: Request,
  ) {
    const actor = adminReviewer(request);
    let updated: KnowledgeVersion;
    await updatePlatformStore((platform) => {
      const item = platform.knowledgeVersions[id];
      if (!item)
        resourceNotFound("KNOWLEDGE_VERSION_NOT_FOUND", "知识版本不存在。");
      item.status = "withdrawn";
      platform.auditEvents.push({
        id: randomUUID(),
        action: "knowledge.withdraw",
        actor,
        created_at: new Date().toISOString(),
      });
      updated = item;
    });
    return success(updated!);
  }
}
