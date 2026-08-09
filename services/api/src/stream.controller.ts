import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  Res,
  BadRequestException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { requireAccountContext } from "./auth.js";
import { sseHandler } from "./ai-stream.js";
import { loadFamilyStore, updateFamilyStore } from "./demo-store.js";
import { chatRequestSchema } from "@boks/contracts";

@Controller("chat")
export class StreamController {
  @Post("conversations/:id/stream")
  async stream(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const context = requireAccountContext(req);
    const family = await loadFamilyStore(context.family_id);
    const conversation = family.conversations[id];
    if (!conversation || conversation.family_id !== context.family_id) {
      throw new BadRequestException({
        error: {
          code: "CHAT_NOT_FOUND",
          message: "咨询会话不存在。",
          details: [],
          retryable: false,
        },
      });
    }
    const input = chatRequestSchema.parse(body);

    // 持久化用户消息（不阻断 SSE）
    const userMsgId = randomUUID();
    const userMsg = {
      id: userMsgId,
      role: "user" as const,
      content: input.content,
      citations: [],
      created_at: new Date().toISOString(),
    };
    void updateFamilyStore(context.family_id, (next) => {
      const target = next.conversations[id];
      if (target) {
        target.child_id = input.child_id ?? target.child_id;
        target.context_report_id =
          input.context_report_id ?? target.context_report_id;
        target.context_plan_id =
          input.context_plan_id ?? target.context_plan_id;
        target.messages.push(userMsg);
      }
    });

    // 透传 SSE
    await sseHandler(req, res, {
      content: input.content,
      child_grade: null,
      audience: null,
      conversation_id: id,
    });
  }
}
