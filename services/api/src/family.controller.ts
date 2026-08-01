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
import { randomUUID } from "node:crypto";
import {
  createChildRequestSchema,
  consentRequestSchema,
  type Child,
  type CreateChildRequest,
} from "@boks/contracts";
import { success } from "./http.js";
import {
  buildChild,
  children,
  getChild,
  persistStore,
  assessmentSessions,
  reports,
  trainingPlans,
  postureSessions,
  postureAssets,
  postureReports,
  store,
} from "./demo-store.js";
import {
  assertChildAccess,
  guardianContext,
  resourceNotFound,
} from "./auth.js";
import { parseInput } from "./validation.js";

@Controller()
export class FamilyController {
  @Get("families/me")
  getFamily(@Req() request: Request, @Headers("x-trace-id") traceId?: string) {
    const context = guardianContext(request);
    return success(
      {
        id: context.family_id,
        display_name: "BOKS 演示家庭",
        children: children.filter((child) => child.profile_status === "active"),
      },
      traceId,
    );
  }

  @Get("families/me/children")
  getChildren(
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    return success(
      children.filter((child) => child.profile_status === "active"),
      traceId,
    );
  }

  @Post("families/me/children")
  createChild(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const input = parseInput(createChildRequestSchema, body);
    const child = buildChild(
      input as Omit<Child, "id" | "age_in_months" | "profile_status">,
    );
    children.push(child);
    void persistStore();
    return success(child, traceId);
  }

  @Get("children/:childId")
  getChild(
    @Param("childId") childId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    assertChildAccess(request, childId);
    const child = getChild(childId);
    if (!child) resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
    return success(child, traceId);
  }

  @Patch("children/:childId")
  updateChild(
    @Param("childId") childId: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    assertChildAccess(request, childId);
    const child = getChild(childId);
    if (!child) resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
    const input = parseInput(
      createChildRequestSchema.partial(),
      body,
    ) as Partial<CreateChildRequest>;
    Object.assign(child, input);
    void persistStore();
    return success(child, traceId);
  }

  @Post("families/me/consents")
  recordConsent(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const input = parseInput(consentRequestSchema, body);
    const context = assertChildAccess(request, input.child_id);
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
    store.consents[consent.id] = consent;
    void persistStore();
    return success(consent, traceId);
  }

  @Get("families/me/consents")
  listConsents(
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    return success(
      Object.values(store.consents).filter(
        (item) => item.family_id === context.family_id,
      ),
      traceId,
    );
  }

  @Post("consents/:consentId/withdraw")
  withdrawConsent(
    @Param("consentId") consentId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const consent = store.consents[consentId];
    if (!consent || consent.family_id !== context.family_id)
      resourceNotFound("CONSENT_NOT_FOUND", "同意记录不存在。");
    consent.granted = false;
    consent.withdrawn_at = new Date().toISOString();
    void persistStore();
    return success(consent, traceId);
  }

  @Post("children/:childId/deletion-request")
  requestDeletion(
    @Param("childId") childId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = assertChildAccess(request, childId);
    const deletion = {
      id: randomUUID(),
      family_id: context.family_id,
      child_id: childId,
      status: "requested" as const,
      created_at: new Date().toISOString(),
    };
    store.deletionRequests.push(deletion);
    void persistStore();
    return success(deletion, traceId);
  }

  @Delete("children/:childId")
  deleteChild(
    @Param("childId") childId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    assertChildAccess(request, childId);
    const child = getChild(childId);
    if (!child) resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
    child.profile_status = "deleted";
    const sessionIds = [...postureSessions.values()]
      .filter((session) => session.child_id === childId)
      .map((session) => session.id);
    for (const [id, session] of assessmentSessions)
      if (session.child_id === childId) assessmentSessions.delete(id);
    for (const [id, report] of reports)
      if (report.child_id === childId) reports.delete(id);
    for (const [id, plan] of trainingPlans) {
      if (plan.child_id === childId) {
        delete store.checkIns[id];
        trainingPlans.delete(id);
      }
    }
    for (const [id, session] of postureSessions)
      if (session.child_id === childId) postureSessions.delete(id);
    for (const id of sessionIds) {
      for (const [assetId, asset] of Object.entries(store.postureAssets))
        if (asset.session_id === id) {
          delete store.postureAssets[assetId];
          postureAssets.delete(assetId);
        }
    }
    for (const [id, report] of Object.entries(postureReports))
      if (report.child_id === childId) delete postureReports[id];
    for (const [id, checkIn] of Object.entries(store.checkIns))
      if (checkIn.child_id === childId) delete store.checkIns[id];
    for (const [id, conversation] of Object.entries(store.conversations))
      if (conversation.child_id === childId) delete store.conversations[id];
    for (const [id, consent] of Object.entries(store.consents))
      if (consent.child_id === childId) delete store.consents[id];
    for (const deletion of store.deletionRequests)
      if (deletion.child_id === childId) deletion.status = "completed";
    void persistStore();
    return success({ id: childId, status: "deleted" }, traceId);
  }

  @Get("families/me/export")
  exportFamily(
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const childIds = children
      .filter((item) => item.profile_status !== "deleted")
      .map((item) => item.id);
    return success(
      {
        family_id: context.family_id,
        exported_at: new Date().toISOString(),
        data: {
          children: children.filter((item) => childIds.includes(item.id)),
          consents: Object.values(store.consents).filter(
            (item) => item.family_id === context.family_id,
          ),
          reports: Object.values(store.reports).filter((item) =>
            childIds.includes(item.child_id),
          ),
          training_plans: Object.values(store.trainingPlans).filter((item) =>
            childIds.includes(item.child_id),
          ),
          posture_reports: Object.values(store.postureReports).filter((item) =>
            childIds.includes(item.child_id),
          ),
          posture_sessions: Object.values(store.postureSessions).filter(
            (item) => childIds.includes(item.child_id),
          ),
          posture_asset_metadata: Object.values(store.postureAssets).filter(
            (item) => {
              const session = store.postureSessions[item.session_id];
              return (
                session !== undefined && childIds.includes(session.child_id)
              );
            },
          ),
          assessment_sessions: Object.values(store.assessmentSessions).filter(
            (item) => childIds.includes(item.child_id),
          ),
          check_ins: Object.values(store.checkIns).filter((item) =>
            childIds.includes(item.child_id),
          ),
          conversations: Object.values(store.conversations).filter(
            (item) =>
              item.family_id === context.family_id &&
              (!item.child_id || childIds.includes(item.child_id)),
          ),
          deletion_requests: store.deletionRequests.filter(
            (item) => item.family_id === context.family_id,
          ),
        },
      },
      traceId,
    );
  }
}
