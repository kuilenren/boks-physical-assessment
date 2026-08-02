import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Delete,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { createHash, randomUUID } from "node:crypto";
import {
  createChildRequestSchema,
  consentRequestSchema,
  type CreateChildRequest,
} from "@boks/contracts";
import { success } from "./http.js";
import {
  buildChild,
  loadFamilyStore,
  updateFamilyStore,
  type DeletionRequest,
} from "./demo-store.js";
import {
  assertChildAccessAsync,
  guardianContext,
  resourceNotFound,
} from "./auth.js";
import { parseInput } from "./validation.js";
import { deletePostureAsset } from "./asset-storage.js";

@Controller()
export class FamilyController {
  @Get("families/me")
  async getFamily(
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    return success(
      {
        id: context.family_id,
        display_name:
          family.families[context.family_id]?.display_name ?? "BOKS 家庭",
        children: family.children.filter(
          (child) =>
            child.family_id === context.family_id &&
            child.profile_status === "active",
        ),
      },
      traceId,
    );
  }

  @Get("families/me/children")
  async getChildren(
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    return success(
      family.children.filter(
        (child) =>
          child.family_id === context.family_id &&
          child.profile_status === "active",
      ),
      traceId,
    );
  }

  @Post("families/me/children")
  async createChild(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const input = parseInput(createChildRequestSchema, body);
    const child = buildChild(input, context.family_id);
    await updateFamilyStore(context.family_id, (family) => {
      family.children.push(child);
    });
    return success(child, traceId);
  }

  @Get("children/:childId")
  async getChild(
    @Param("childId") childId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = await assertChildAccessAsync(request, childId);
    const family = await loadFamilyStore(context.family_id);
    const child = family.children.find(
      (item) => item.id === childId && item.profile_status === "active",
    );
    if (!child) resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
    return success(child, traceId);
  }

  @Patch("children/:childId")
  async updateChild(
    @Param("childId") childId: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = await assertChildAccessAsync(request, childId);
    const family = await loadFamilyStore(context.family_id);
    const child = family.children.find(
      (item) => item.id === childId && item.profile_status === "active",
    );
    if (!child) resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
    const input = parseInput(
      createChildRequestSchema.partial(),
      body,
    ) as Partial<CreateChildRequest>;
    const updatedChild = { ...child, ...input };
    await updateFamilyStore(context.family_id, (next) => {
      const target = next.children.find((item) => item.id === childId);
      if (!target) resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
      Object.assign(target, input);
    });
    return success(updatedChild, traceId);
  }

  @Post("families/me/consents")
  async recordConsent(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const input = parseInput(consentRequestSchema, body);
    const context = await assertChildAccessAsync(request, input.child_id);
    const consent = {
      id: randomUUID(),
      family_id: context.family_id,
      child_id: input.child_id,
      purpose: input.purpose,
      version: input.version,
      granted: input.granted,
      granted_at: new Date().toISOString(),
      withdrawn_at: input.granted ? null : new Date().toISOString(),
    };
    await updateFamilyStore(context.family_id, (family) => {
      family.consents[consent.id] = consent;
    });
    return success(consent, traceId);
  }

  @Get("families/me/consents")
  async listConsents(
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    return success(
      Object.values(family.consents).filter(
        (item) => item.family_id === context.family_id,
      ),
      traceId,
    );
  }

  @Post("consents/:consentId/withdraw")
  async withdrawConsent(
    @Param("consentId") consentId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const consent = family.consents[consentId];
    if (!consent || consent.family_id !== context.family_id)
      resourceNotFound("CONSENT_NOT_FOUND", "同意记录不存在。");
    await updateFamilyStore(context.family_id, (next) => {
      const target = next.consents[consentId];
      if (!target) resourceNotFound("CONSENT_NOT_FOUND", "同意记录不存在。");
      target.granted = false;
      target.withdrawn_at = new Date().toISOString();
    });
    return success(consent, traceId);
  }

  @Post("children/:childId/deletion-request")
  async requestDeletion(
    @Param("childId") childId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = await assertChildAccessAsync(request, childId);
    const deletion = {
      id: randomUUID(),
      family_id: context.family_id,
      child_id: childId,
      status: "requested" as const,
      created_at: new Date().toISOString(),
      completed_at: null,
      deleted_asset_count: 0,
      proof_hash: null,
    };
    let persistedDeletion: DeletionRequest = deletion;
    await updateFamilyStore(context.family_id, (next) => {
      const existing = next.deletionRequests.find(
        (item) =>
          item.family_id === context.family_id &&
          item.child_id === childId &&
          item.status === "requested",
      );
      if (existing) {
        persistedDeletion = existing;
        return;
      }
      next.deletionRequests.push(deletion);
    });
    return success(persistedDeletion, traceId);
  }

  @Delete("children/:childId")
  async deleteChild(
    @Param("childId") childId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = await assertChildAccessAsync(request, childId);
    const family = await loadFamilyStore(context.family_id);
    const child = family.children.find(
      (item) => item.id === childId && item.profile_status === "active",
    );
    if (!child) resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
    const sessionIds = Object.values(family.postureSessions)
      .filter((session) => session.child_id === childId)
      .map((session) => session.id);
    const assets = Object.values(family.postureAssets).filter((asset) =>
      sessionIds.includes(asset.session_id),
    );
    for (const asset of assets)
      await deletePostureAsset(asset.metadata.storage_key);

    const deletion =
      family.deletionRequests.find(
        (item) =>
          item.family_id === context.family_id &&
          item.child_id === childId &&
          item.status === "requested",
      ) ??
      (() => {
        const item: DeletionRequest = {
          id: randomUUID(),
          family_id: context.family_id,
          child_id: childId,
          status: "requested" as const,
          created_at: new Date().toISOString(),
          completed_at: null,
          deleted_asset_count: 0,
          proof_hash: null,
        };
        family.deletionRequests.push(item);
        return item;
      })();

    const completedAt = new Date().toISOString();
    const proofHash = createHash("sha256")
      .update(
        [
          childId,
          completedAt,
          ...assets
            .map((asset) => `${asset.id}:${asset.metadata.storage_key ?? ""}`)
            .sort(),
        ].join("|"),
      )
      .digest("hex");
    deletion.status = "completed";
    deletion.completed_at = completedAt;
    deletion.deleted_asset_count = assets.length;
    deletion.proof_hash = proofHash;
    await updateFamilyStore(context.family_id, (next) => {
      const targetChild = next.children.find((item) => item.id === childId);
      if (!targetChild) resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
      targetChild.profile_status = "deleted";
      for (const [id, session] of Object.entries(next.assessmentSessions))
        if (session.child_id === childId) delete next.assessmentSessions[id];
      for (const [id, report] of Object.entries(next.reports))
        if (report.child_id === childId) delete next.reports[id];
      for (const [id, plan] of Object.entries(next.trainingPlans))
        if (plan.child_id === childId) delete next.trainingPlans[id];
      for (const [id, session] of Object.entries(next.postureSessions))
        if (session.child_id === childId) delete next.postureSessions[id];
      for (const asset of assets) delete next.postureAssets[asset.id];
      for (const [id, report] of Object.entries(next.postureReports))
        if (report.child_id === childId) delete next.postureReports[id];
      for (const [id, checkIn] of Object.entries(next.checkIns))
        if (checkIn.child_id === childId) delete next.checkIns[id];
      for (const [id, conversation] of Object.entries(next.conversations))
        if (conversation.child_id === childId) delete next.conversations[id];
      for (const [id, consent] of Object.entries(next.consents))
        if (consent.child_id === childId) delete next.consents[id];
      const targetDeletion =
        next.deletionRequests.find((item) => item.id === deletion.id) ??
        (() => {
          next.deletionRequests.push(deletion);
          return deletion;
        })();
      Object.assign(targetDeletion, deletion);
    });
    return success(
      {
        id: childId,
        status: "deleted",
        deletion_proof: {
          request_id: deletion.id,
          completed_at: completedAt,
          deleted_asset_count: assets.length,
          proof_hash: proofHash,
        },
      },
      traceId,
    );
  }

  @Get("families/me/export")
  async exportFamily(
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const childIds = family.children
      .filter(
        (item) =>
          item.family_id === context.family_id &&
          item.profile_status !== "deleted",
      )
      .map((item) => item.id);
    return success(
      {
        family_id: context.family_id,
        exported_at: new Date().toISOString(),
        data: {
          children: family.children.filter((item) =>
            childIds.includes(item.id),
          ),
          consents: Object.values(family.consents).filter(
            (item) => item.family_id === context.family_id,
          ),
          reports: Object.values(family.reports).filter((item) =>
            childIds.includes(item.child_id),
          ),
          training_plans: Object.values(family.trainingPlans).filter((item) =>
            childIds.includes(item.child_id),
          ),
          posture_reports: Object.values(family.postureReports).filter((item) =>
            childIds.includes(item.child_id),
          ),
          posture_sessions: Object.values(family.postureSessions).filter(
            (item) => childIds.includes(item.child_id),
          ),
          posture_asset_metadata: Object.values(family.postureAssets).filter(
            (item) => {
              const session = family.postureSessions[item.session_id];
              return (
                session !== undefined && childIds.includes(session.child_id)
              );
            },
          ),
          assessment_sessions: Object.values(family.assessmentSessions).filter(
            (item) => childIds.includes(item.child_id),
          ),
          check_ins: Object.values(family.checkIns).filter((item) =>
            childIds.includes(item.child_id),
          ),
          conversations: Object.values(family.conversations).filter(
            (item) =>
              item.family_id === context.family_id &&
              (!item.child_id || childIds.includes(item.child_id)),
          ),
          deletion_requests: family.deletionRequests.filter(
            (item) => item.family_id === context.family_id,
          ),
        },
      },
      traceId,
    );
  }
}
