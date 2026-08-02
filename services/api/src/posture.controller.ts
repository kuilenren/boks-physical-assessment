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
  BadRequestException,
} from "@nestjs/common";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import {
  attachPostureViewRequestSchema,
  createPostureSessionRequestSchema,
  createPostureUploadUrlRequestSchema,
  completePostureUploadRequestSchema,
  postureViewSchema,
  uploadPostureViewRequestSchema,
} from "@boks/contracts";
import {
  createPostureSession,
  loadFamilyStore,
  updateFamilyStore,
} from "./demo-store.js";
import {
  guardianContext,
  resourceForbidden,
  resourceNotFound,
} from "./auth.js";
import { success } from "./http.js";
import { parseInput } from "./validation.js";
import {
  completePostureUpload,
  createPostureUploadUrl,
  savePostureAsset,
} from "./asset-storage.js";
import { isProductionRuntime } from "./runtime-config.js";

function requireFamilyChild(
  family: Awaited<ReturnType<typeof loadFamilyStore>>,
  childId: string,
) {
  const child = family.children.find(
    (item) => item.id === childId && item.profile_status === "active",
  );
  if (!child) resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
  return child;
}

function requirePhotoConsent(
  family: Awaited<ReturnType<typeof loadFamilyStore>>,
  childId: string,
  recordId?: string,
) {
  requireFamilyChild(family, childId);
  const consent = recordId
    ? family.consents[recordId]
    : Object.values(family.consents).find(
        (item) =>
          item.child_id === childId &&
          item.purpose === "photo" &&
          item.granted &&
          item.withdrawn_at === null,
      );
  if (
    !consent ||
    consent.child_id !== childId ||
    consent.purpose !== "photo" ||
    !consent.granted ||
    consent.withdrawn_at !== null
  )
    resourceForbidden(
      "CONSENT_REQUIRED",
      "需要当前家庭对该儿童的有效照片同意记录。",
    );
  return consent;
}

@Controller("posture")
export class PostureController {
  @Post("sessions")
  async createSession(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const input = parseInput(createPostureSessionRequestSchema, body);
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    requirePhotoConsent(family, input.child_id, input.consent_record_id);
    let session: ReturnType<typeof createPostureSession> | undefined;
    const updatedFamily = await updateFamilyStore(context.family_id, (next) => {
      session = createPostureSession(
        input.child_id,
        input.consent_record_id,
        input.capture_protocol_version,
        input.required_views,
        next,
      );
    });
    if (!session) throw new Error("体态任务创建失败。");
    return success(session, traceId);
  }

  @Post("sessions/:sessionId/views/:view/attach")
  async attachView(
    @Param("sessionId") sessionId: string,
    @Param("view") viewValue: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const session = family.postureSessions[sessionId];
    if (!session)
      resourceNotFound("POSTURE_SESSION_NOT_FOUND", "体态任务不存在。");
    requirePhotoConsent(family, session.child_id);
    const view = postureViewSchema.parse(viewValue);
    const input = parseInput(attachPostureViewRequestSchema, body);
    if (!session.required_views.includes(view)) {
      throw new NotFoundException("当前任务不需要该视角。");
    }
    const existing = family.postureAssets[input.asset_id];
    if (existing && existing.session_id !== sessionId)
      throw new NotFoundException("该照片资源不属于当前体态任务。");
    if (existing && existing.view !== view)
      throw new BadRequestException("照片资源已绑定到其他视角。");
    if (!existing && isProductionRuntime())
      throw new NotFoundException("照片尚未完成安全上传。");
    const updatedFamily = await updateFamilyStore(context.family_id, (next) => {
      const targetSession = next.postureSessions[sessionId];
      if (!targetSession)
        resourceNotFound("POSTURE_SESSION_NOT_FOUND", "体态任务不存在。");
      const targetAsset = next.postureAssets[input.asset_id];
      if (targetAsset && targetAsset.session_id !== sessionId)
        throw new NotFoundException("该照片资源不属于当前体态任务。");
      if (targetAsset && targetAsset.view !== view)
        throw new BadRequestException("照片资源已绑定到其他视角。");
      next.postureAssets[input.asset_id] = {
        id: input.asset_id,
        session_id: sessionId,
        view,
        metadata: targetAsset?.metadata ?? {
          mime_type: "image/*",
          size_bytes: 0,
          captured_at: new Date().toISOString(),
          storage_status: "legacy_unverified",
        },
      };
      if (!targetSession.attached_views.includes(view))
        targetSession.attached_views.push(view);
      targetSession.status = "capturing";
    });
    return success(updatedFamily.postureSessions[sessionId], traceId);
  }

  @Post("sessions/:sessionId/views/:view/upload")
  async uploadView(
    @Param("sessionId") sessionId: string,
    @Param("view") viewValue: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const session = family.postureSessions[sessionId];
    if (!session)
      resourceNotFound("POSTURE_SESSION_NOT_FOUND", "体态任务不存在。");
    requirePhotoConsent(family, session.child_id);
    const view = postureViewSchema.parse(viewValue);
    const input = parseInput(uploadPostureViewRequestSchema, body);
    if (!session.required_views.includes(view))
      throw new NotFoundException("当前任务不需要该视角。");
    const bytes = Buffer.from(input.content_base64, "base64");
    if (bytes.length !== input.size_bytes)
      throw new BadRequestException("照片内容与声明大小不一致。");
    const assetId = randomUUID();
    const stored = await savePostureAsset({
      assetId,
      mimeType: input.mime_type,
      bytes,
    });
    const updatedFamily = await updateFamilyStore(context.family_id, (next) => {
      const targetSession = next.postureSessions[sessionId];
      if (!targetSession)
        resourceNotFound("POSTURE_SESSION_NOT_FOUND", "体态任务不存在。");
      next.postureAssets[assetId] = {
        id: assetId,
        session_id: sessionId,
        view,
        metadata: {
          mime_type: input.mime_type,
          size_bytes: bytes.length,
          captured_at: new Date().toISOString(),
          storage_status: "uploaded",
          storage_key: stored.storageKey,
          checksum_sha256: stored.checksumSha256,
          width_px: stored.widthPx ?? undefined,
          height_px: stored.heightPx ?? undefined,
          quality_status: stored.status,
          quality_score: stored.score,
          quality_reasons: stored.reasons,
        },
      };
      if (!targetSession.attached_views.includes(view))
        targetSession.attached_views.push(view);
      targetSession.status = "capturing";
    });
    return success(updatedFamily.postureSessions[sessionId], traceId);
  }

  @Post("sessions/:sessionId/views/:view/upload-url")
  async createUploadUrl(
    @Param("sessionId") sessionId: string,
    @Param("view") viewValue: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const session = family.postureSessions[sessionId];
    if (!session)
      resourceNotFound("POSTURE_SESSION_NOT_FOUND", "体态任务不存在。");
    requirePhotoConsent(family, session.child_id);
    const view = postureViewSchema.parse(viewValue);
    const input = parseInput(createPostureUploadUrlRequestSchema, body);
    if (!session.required_views.includes(view))
      throw new NotFoundException("当前任务不需要该视角。");
    const assetId = randomUUID();
    const upload = createPostureUploadUrl({
      assetId,
      mimeType: input.mime_type,
    });
    await updateFamilyStore(context.family_id, (next) => {
      next.postureAssets[assetId] = {
        id: assetId,
        session_id: sessionId,
        view,
        metadata: {
          mime_type: input.mime_type,
          size_bytes: input.size_bytes,
          captured_at: new Date().toISOString(),
          storage_status: "pending_upload",
          storage_key: upload.storageKey,
        },
      };
    });
    return success(
      {
        asset_id: assetId,
        storage_key: upload.storageKey,
        upload_url: upload.uploadUrl,
        required_headers: upload.requiredHeaders,
        expires_at: upload.expiresAt,
      },
      traceId,
    );
  }

  @Post("sessions/:sessionId/views/:view/upload-complete")
  async completeUpload(
    @Param("sessionId") sessionId: string,
    @Param("view") viewValue: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const session = family.postureSessions[sessionId];
    if (!session)
      resourceNotFound("POSTURE_SESSION_NOT_FOUND", "体态任务不存在。");
    requirePhotoConsent(family, session.child_id);
    const view = postureViewSchema.parse(viewValue);
    const input = parseInput(completePostureUploadRequestSchema, body);
    if (!session.required_views.includes(view))
      throw new NotFoundException("当前任务不需要该视角。");
    const asset = family.postureAssets[input.asset_id];
    if (
      !asset ||
      asset.session_id !== sessionId ||
      asset.view !== view ||
      asset.metadata.storage_status !== "pending_upload" ||
      !asset.metadata.storage_key ||
      asset.metadata.size_bytes !== input.size_bytes ||
      asset.metadata.mime_type !== input.mime_type
    )
      resourceNotFound("POSTURE_ASSET_NOT_FOUND", "待确认的照片资源不存在。");
    const stored = await completePostureUpload({
      storageKey: asset.metadata.storage_key,
      mimeType: input.mime_type,
      sizeBytes: input.size_bytes,
      checksumSha256: input.checksum_sha256,
    });
    const updatedFamily = await updateFamilyStore(context.family_id, (next) => {
      const targetSession = next.postureSessions[sessionId];
      const targetAsset = next.postureAssets[input.asset_id];
      if (!targetSession || !targetAsset)
        resourceNotFound("POSTURE_ASSET_NOT_FOUND", "待确认的照片资源不存在。");
      targetAsset.metadata = {
        ...targetAsset.metadata,
        mime_type: input.mime_type,
        size_bytes: input.size_bytes,
        storage_status: "uploaded",
        checksum_sha256: stored.checksumSha256,
        width_px: stored.widthPx ?? undefined,
        height_px: stored.heightPx ?? undefined,
        quality_status: stored.status,
        quality_score: stored.score,
        quality_reasons: stored.reasons,
      };
      if (!targetSession.attached_views.includes(view))
        targetSession.attached_views.push(view);
      targetSession.status = "capturing";
    });
    return success(updatedFamily.postureSessions[sessionId], traceId);
  }

  @Post("sessions/:sessionId/submit")
  async submitSession(
    @Param("sessionId") sessionId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const session = family.postureSessions[sessionId];
    if (!session)
      resourceNotFound("POSTURE_SESSION_NOT_FOUND", "体态任务不存在。");
    requirePhotoConsent(family, session.child_id);
    const updatedFamily = await updateFamilyStore(context.family_id, (next) => {
      const targetSession = next.postureSessions[sessionId];
      if (!targetSession)
        resourceNotFound("POSTURE_SESSION_NOT_FOUND", "体态任务不存在。");
      targetSession.status = "quality_check";
      for (const view of targetSession.required_views) {
        const quality = targetSession.quality.views[view];
        if (!quality) continue;
        const asset = Object.values(next.postureAssets).find(
          (item) => item.session_id === sessionId && item.view === view,
        );
        if (
          asset &&
          targetSession.attached_views.includes(view) &&
          asset.metadata.quality_status === "passed"
        ) {
          quality.status = "passed";
          quality.score = asset.metadata.quality_score ?? 0.9;
          quality.reasons = asset.metadata.quality_reasons ?? [];
        } else {
          quality.status = "needs_retake";
          quality.score = 0;
          quality.reasons =
            asset?.metadata.quality_reasons ??
            (asset
              ? ["照片质量检查未通过，请按拍摄提示重新上传。"]
              : ["该视角尚未完成安全上传。"]);
        }
      }
      const allPassed = targetSession.required_views.every(
        (view) => targetSession.quality.views[view]?.status === "passed",
      );
      targetSession.quality.overall = allPassed ? "passed" : "needs_retake";
      targetSession.status = allPassed ? "completed" : "capturing";
      if (allPassed) {
        const report = {
          id: randomUUID(),
          report_type: "posture" as const,
          child_id: targetSession.child_id,
          session_id: targetSession.id,
          risk_level: "not_scored" as const,
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
        next.postureReports[report.id] = report;
        targetSession.analysis = {
          report_id: report.id,
          risk_level: report.risk_level,
          observation_status: report.observation_status,
          confidence: report.confidence,
        };
      }
    });
    return success(updatedFamily.postureSessions[sessionId], traceId);
  }

  @Get("sessions/:sessionId")
  async getSession(
    @Param("sessionId") sessionId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const session = family.postureSessions[sessionId];
    if (!session)
      resourceNotFound("POSTURE_SESSION_NOT_FOUND", "体态任务不存在。");
    requirePhotoConsent(family, session.child_id);
    return success(session, traceId);
  }

  @Get("reports/:reportId")
  async getReport(
    @Param("reportId") reportId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const report = family.postureReports[reportId];
    if (!report)
      resourceNotFound("POSTURE_REPORT_NOT_FOUND", "体态报告不存在。");
    requireFamilyChild(family, report.child_id);
    return success(report, traceId);
  }

  @Get("reports")
  async listReports(
    @Query("child_id") childId: string | undefined,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    if (childId) requireFamilyChild(family, childId);
    return success(
      Object.values(family.postureReports).filter(
        (report) =>
          report.child_id === childId ||
          (childId === undefined &&
            Boolean(
              family.children.find(
                (child) =>
                  child.id === report.child_id &&
                  child.family_id === context.family_id &&
                  child.profile_status === "active",
              ),
            )),
      ),
      traceId,
    );
  }

  @Get("sessions/:sessionId/assets/:assetId")
  async getAssetMetadata(
    @Param("sessionId") sessionId: string,
    @Param("assetId") assetId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const asset = family.postureAssets[assetId];
    const session = family.postureSessions[sessionId];
    if (!asset || asset.session_id !== sessionId || !session)
      resourceNotFound("POSTURE_ASSET_NOT_FOUND", "资源不存在。");
    requirePhotoConsent(family, session.child_id);
    return success(
      { id: asset.id, view: asset.view, metadata: asset.metadata },
      traceId,
    );
  }
}
