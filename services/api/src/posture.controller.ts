import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  NotFoundException,
  Req,
  Query,
} from "@nestjs/common";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import {
  attachPostureViewRequestSchema,
  createPostureSessionRequestSchema,
  postureViewSchema,
} from "@boks/contracts";
import {
  createPostureSession,
  postureAssets,
  postureSessions,
  postureReports,
  persistStore,
  store,
} from "./demo-store.js";
import {
  assertChildAccess,
  guardianContext,
  requireConsent,
  requireConsentRecord,
  resourceNotFound,
} from "./auth.js";
import { success } from "./http.js";
import { parseInput } from "./validation.js";

@Controller("posture")
export class PostureController {
  @Post("sessions")
  createSession(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const input = parseInput(createPostureSessionRequestSchema, body);
    requireConsentRecord(
      request,
      input.consent_record_id,
      input.child_id,
      "photo",
    );
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
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const session = postureSessions.get(sessionId);
    if (!session)
      resourceNotFound("POSTURE_SESSION_NOT_FOUND", "体态任务不存在。");
    assertChildAccess(request, session.child_id);
    requireConsent(request, session.child_id, "photo");
    const view = postureViewSchema.parse(viewValue);
    const input = parseInput(attachPostureViewRequestSchema, body);
    if (!session.required_views.includes(view)) {
      throw new NotFoundException("当前任务不需要该视角。");
    }
    postureAssets.set(input.asset_id, view);
    store.postureAssets[input.asset_id] = {
      id: input.asset_id,
      session_id: sessionId,
      view,
      metadata: {
        mime_type: "image/*",
        size_bytes: 0,
        captured_at: new Date().toISOString(),
      },
    };
    if (!session.attached_views.includes(view))
      session.attached_views.push(view);
    session.status = "capturing";
    return success(session, traceId);
  }

  @Post("sessions/:sessionId/submit")
  submitSession(
    @Param("sessionId") sessionId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const session = postureSessions.get(sessionId);
    if (!session)
      resourceNotFound("POSTURE_SESSION_NOT_FOUND", "体态任务不存在。");
    assertChildAccess(request, session.child_id);
    requireConsent(request, session.child_id, "photo");
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
    if (allPassed) {
      const report = {
        id: randomUUID(),
        report_type: "posture" as const,
        child_id: session.child_id,
        session_id: session.id,
        risk_level: "A" as const,
        observation_status: "insufficient_data" as const,
        confidence: "low" as const,
        observations: [
          "四视角任务质量通过，但当前没有真实姿态模型，无法测量或确认风险。",
        ],
        recommendations: [
          "建议在自然光下按同一拍摄协议复拍；如有持续不适，请由专业人员人工复核。",
        ],
        limitations: [
          "非诊断性观察，不输出角度、骨骼测量或疾病结论。",
          "照片不会写入日志。",
        ],
        generated_at: new Date().toISOString(),
      };
      postureReports[report.id] = report;
      session.analysis = {
        report_id: report.id,
        risk_level: report.risk_level,
        observation_status: report.observation_status,
        confidence: report.confidence,
      };
    }
    void persistStore();
    return success(session, traceId);
  }

  @Get("sessions/:sessionId")
  getSession(
    @Param("sessionId") sessionId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const session = postureSessions.get(sessionId);
    if (!session)
      resourceNotFound("POSTURE_SESSION_NOT_FOUND", "体态任务不存在。");
    assertChildAccess(request, session.child_id);
    return success(session, traceId);
  }

  @Get("reports/:reportId")
  getReport(
    @Param("reportId") reportId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const report = postureReports[reportId];
    if (!report)
      resourceNotFound("POSTURE_REPORT_NOT_FOUND", "体态报告不存在。");
    assertChildAccess(request, report.child_id);
    return success(report, traceId);
  }

  @Get("reports")
  listReports(
    @Query("child_id") childId: string | undefined,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    if (childId) assertChildAccess(request, childId);
    return success(
      Object.values(postureReports).filter(
        (report) =>
          report.child_id === childId ||
          (childId === undefined &&
            context.family_id === store.family_id &&
            Boolean(
              store.children.find((child) => child.id === report.child_id),
            )),
      ),
      traceId,
    );
  }

  @Get("sessions/:sessionId/assets/:assetId")
  getAssetMetadata(
    @Param("sessionId") sessionId: string,
    @Param("assetId") assetId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const asset = store.postureAssets[assetId];
    const session = postureSessions.get(sessionId);
    if (!asset || asset.session_id !== sessionId || !session)
      resourceNotFound("POSTURE_ASSET_NOT_FOUND", "资源不存在。");
    assertChildAccess(request, session.child_id);
    return success(
      { id: asset.id, view: asset.view, metadata: asset.metadata },
      traceId,
    );
  }
}
