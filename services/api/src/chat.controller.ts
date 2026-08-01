import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  NotFoundException,
} from "@nestjs/common";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { chatRequestSchema } from "@boks/contracts";
import {
  assertChildAccess,
  guardianContext,
  resourceForbidden,
  resourceNotFound,
} from "./auth.js";
import {
  persistStore,
  reports,
  store,
  trainingPlans,
  type ChatConversation,
} from "./demo-store.js";
import { success } from "./http.js";
import { parseInput } from "./validation.js";

const safetyPattern = /疼痛|麻木|无力|夜间疼痛|呼吸困难|急症|诊断|Cobb|cobb角/i;
function citations() {
  const published = Object.values(store.knowledgeVersions).filter(
    (item) => item.status === "published",
  );
  return published.length > 0
    ? published.slice(0, 3).map((item) => ({
        source_id: item.source_id,
        title: item.title,
        version: item.version,
      }))
    : [
        {
          source_id: "assessment-configuration",
          title: "BOKS 已发布配置（开发中）",
          version: store.configuration.active_standard_id,
        },
      ];
}
@Controller("chat")
export class ChatController {
  @Post("conversations")
  create(@Req() request: Request) {
    const context = guardianContext(request);
    const conversation: ChatConversation = {
      id: randomUUID(),
      family_id: context.family_id,
      child_id: null,
      context_report_id: null,
      context_plan_id: null,
      messages: [],
      created_at: new Date().toISOString(),
    };
    store.conversations[conversation.id] = conversation;
    void persistStore();
    return success(conversation);
  }
  @Get("conversations/:id")
  get(@Param("id") id: string, @Req() request: Request) {
    const context = guardianContext(request);
    const conversation = store.conversations[id];
    if (!conversation || conversation.family_id !== context.family_id)
      throw new NotFoundException("咨询会话不存在。");
    return success(conversation);
  }
  @Post("conversations/:id/messages")
  message(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    const context = guardianContext(request);
    const conversation = store.conversations[id];
    if (!conversation || conversation.family_id !== context.family_id)
      throw new NotFoundException("咨询会话不存在。");
    const input = parseInput(chatRequestSchema, body);
    let contextChildId = input.child_id;
    if (input.child_id) assertChildAccess(request, input.child_id);
    if (input.context_report_id) {
      const report = reports.get(input.context_report_id);
      if (!report)
        resourceNotFound(
          "ASSESSMENT_REPORT_NOT_FOUND",
          "咨询引用的体测报告不存在。",
        );
      assertChildAccess(request, report.child_id);
      if (contextChildId && contextChildId !== report.child_id)
        resourceForbidden(
          "RESOURCE_FORBIDDEN",
          "咨询引用的报告不属于当前儿童。",
        );
      contextChildId = report.child_id;
    }
    if (input.context_plan_id) {
      const plan = trainingPlans.get(input.context_plan_id);
      if (!plan)
        resourceNotFound(
          "TRAINING_PLAN_NOT_FOUND",
          "咨询引用的训练计划不存在。",
        );
      assertChildAccess(request, plan.child_id);
      if (contextChildId && contextChildId !== plan.child_id)
        resourceForbidden(
          "RESOURCE_FORBIDDEN",
          "咨询引用的计划不属于当前儿童。",
        );
      contextChildId = plan.child_id;
    }
    const user = {
      id: randomUUID(),
      role: "user" as const,
      content: input.content,
      citations: [],
      created_at: new Date().toISOString(),
    };
    const content = safetyPattern.test(input.content)
      ? "我不能根据文字或照片做诊断，也不能判断 Cobb 角。请立即停止训练；如有呼吸困难、急症或明显无力，请及时就医。其他持续疼痛、麻木或夜间疼痛，请联系专业人员人工评估。"
      : "我可以介绍 BOKS 体测、训练、体态拍摄流程和隐私控制。这里的内容仅用于健康教育，不替代医疗诊断。请告诉我你想了解体测、训练、体态还是隐私。";
    const assistant = {
      id: randomUUID(),
      role: "assistant" as const,
      content,
      citations: citations(),
      created_at: new Date().toISOString(),
    };
    conversation.child_id = contextChildId;
    conversation.context_report_id = input.context_report_id;
    conversation.context_plan_id = input.context_plan_id;
    conversation.messages.push(user, assistant);
    void persistStore();
    return success({ message: assistant, conversation_id: id });
  }
}
