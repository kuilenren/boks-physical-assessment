import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  NotFoundException,
} from "@nestjs/common";
import {
  attachPostureViewRequestSchema,
  createPostureSessionRequestSchema,
  postureViewSchema,
} from "@boks/contracts";
import {
  createPostureSession,
  getChild,
  postureAssets,
  postureSessions,
} from "./demo-store.js";
import { success } from "./http.js";
import { parseInput } from "./validation.js";

@Controller("posture")
export class PostureController {
  @Post("sessions")
  createSession(
    @Body() body: unknown,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const input = parseInput(createPostureSessionRequestSchema, body);
    if (!getChild(input.child_id)) {
      throw new NotFoundException("儿童档案不存在。");
    }
    return success(
      createPostureSession(
        input.child_id,
        input.consent_record_id,
        input.capture_protocol_version,
        input.required_views,
      ),
      traceId,
    );
  }

  @Post("sessions/:sessionId/views/:view/attach")
  attachView(
    @Param("sessionId") sessionId: string,
    @Param("view") viewValue: string,
    @Body() body: unknown,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const session = postureSessions.get(sessionId);
    if (!session) throw new NotFoundException("体态任务不存在。");
    const view = postureViewSchema.parse(viewValue);
    const input = parseInput(attachPostureViewRequestSchema, body);
    if (!session.required_views.includes(view)) {
      throw new NotFoundException("当前任务不需要该视角。");
    }
    postureAssets.set(input.asset_id, view);
    if (!session.attached_views.includes(view))
      session.attached_views.push(view);
    session.status = "capturing";
    return success(session, traceId);
  }

  @Post("sessions/:sessionId/submit")
  submitSession(
    @Param("sessionId") sessionId: string,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const session = postureSessions.get(sessionId);
    if (!session) throw new NotFoundException("体态任务不存在。");
    session.status = "quality_check";
    for (const view of session.required_views) {
      const quality = session.quality.views[view];
      if (!quality) continue;
      if (session.attached_views.includes(view)) {
        quality.status = "passed";
        quality.score = 0.9;
        quality.reasons = [];
      } else {
        quality.status = "needs_retake";
        quality.score = 0;
        quality.reasons = ["该视角尚未完成拍摄。"];
      }
    }
    const allPassed = session.required_views.every(
      (view) => session.quality.views[view]?.status === "passed",
    );
    session.quality.overall = allPassed ? "passed" : "needs_retake";
    session.status = allPassed ? "completed" : "capturing";
    return success(session, traceId);
  }

  @Get("sessions/:sessionId")
  getSession(
    @Param("sessionId") sessionId: string,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const session = postureSessions.get(sessionId);
    if (!session) throw new NotFoundException("体态任务不存在。");
    return success(session, traceId);
  }
}
