import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Patch,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import {
  createAssessmentSessionRequestSchema,
  saveAssessmentSessionRequestSchema,
  submitAssessmentRequestSchema,
  type AssessmentValue,
} from "@boks/contracts";
import {
  createAssessmentReport,
  getAssessmentSchema,
  loadFamilyStore,
  updateFamilyStore,
} from "./demo-store.js";
import { success } from "./http.js";
import { parseInput } from "./validation.js";
import {
  requireAccountContext,
  requireRole,
  resourceNotFound,
} from "./auth.js";

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

@Controller()
export class AssessmentController {
  @Get("assessment/schemas")
  async getSchema(
    @Query("child_id") childId: string,
    @Query("measurement_date")
    measurementDate = new Date().toISOString().slice(0, 10),
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = requireAccountContext(request);
    const family = await loadFamilyStore(context.family_id);
    const child = requireFamilyChild(family, childId);
    return success(
      getAssessmentSchema(child, measurementDate, family),
      traceId,
    );
  }

  @Post("assessment/sessions")
  async createSession(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const input = parseInput(createAssessmentSessionRequestSchema, body);
    const context = requireRole(request, ["staff", "super_admin"]);
    const family = await loadFamilyStore(context.family_id);
    const child = requireFamilyChild(family, input.child_id);
    const schema = getAssessmentSchema(child, input.measurement_date, family);
    if (input.standard_version_id !== schema.standard_version_id) {
      resourceNotFound(
        "ASSESSMENT_STANDARD_NOT_FOUND",
        "标准版本不存在或不适用于当前儿童。",
      );
    }
    const id = randomUUID();
    const session = {
      id,
      child_id: child.id,
      measurement_date: input.measurement_date,
      standard_version_id: schema.standard_version_id,
      status: "draft" as const,
      test_status: "completed" as const,
      values: [] as AssessmentValue[],
      report_id: null,
    };
    await updateFamilyStore(context.family_id, (next) => {
      next.assessmentSessions[id] = session;
    });
    return success(session, traceId);
  }

  @Get("assessment/sessions/:sessionId")
  async getSession(
    @Param("sessionId") sessionId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = requireAccountContext(request);
    const family = await loadFamilyStore(context.family_id);
    const session = family.assessmentSessions[sessionId];
    if (!session)
      resourceNotFound("ASSESSMENT_SESSION_NOT_FOUND", "体测任务不存在。");
    requireFamilyChild(family, session.child_id);
    return success(session, traceId);
  }

  @Patch("assessment/sessions/:sessionId")
  async saveSession(
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = requireRole(request, ["staff", "super_admin"]);
    const family = await loadFamilyStore(context.family_id);
    const session = family.assessmentSessions[sessionId];
    if (!session)
      resourceNotFound("ASSESSMENT_SESSION_NOT_FOUND", "体测任务不存在。");
    requireFamilyChild(family, session.child_id);
    const input = parseInput(saveAssessmentSessionRequestSchema, body);
    const updatedSession = { ...session, ...input };
    await updateFamilyStore(context.family_id, (next) => {
      const target = next.assessmentSessions[sessionId];
      if (!target)
        resourceNotFound("ASSESSMENT_SESSION_NOT_FOUND", "体测任务不存在。");
      Object.assign(target, input);
    });
    return success(updatedSession, traceId);
  }

  @Post("assessment/sessions/:sessionId/submit")
  async submitSession(
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = requireRole(request, ["staff", "super_admin"]);
    const family = await loadFamilyStore(context.family_id);
    const session = family.assessmentSessions[sessionId];
    if (!session)
      resourceNotFound("ASSESSMENT_SESSION_NOT_FOUND", "体测任务不存在。");
    requireFamilyChild(family, session.child_id);
    const input = parseInput(submitAssessmentRequestSchema, body);
    let report: ReturnType<typeof createAssessmentReport> | undefined;
    await updateFamilyStore(context.family_id, (next) => {
      const targetSession = next.assessmentSessions[sessionId];
      const targetChild = next.children.find(
        (item) =>
          item.id === session.child_id && item.profile_status === "active",
      );
      if (!targetSession)
        resourceNotFound("ASSESSMENT_SESSION_NOT_FOUND", "体测任务不存在。");
      if (!targetChild) resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
      const schema = getAssessmentSchema(
        targetChild,
        targetSession.measurement_date,
        next,
      );
      targetSession.values = input.values;
      targetSession.test_status = input.test_status;
      targetSession.status = "validating";
      report = createAssessmentReport(
        targetSession.id,
        targetChild,
        schema,
        targetSession.values,
        targetSession.test_status,
        next,
      );
    });
    if (!report) throw new Error("体测报告生成失败。");
    return success(report, traceId);
  }

  @Get("assessment/history")
  async getHistory(
    @Query("child_id") childId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = requireAccountContext(request);
    const family = await loadFamilyStore(context.family_id);
    requireFamilyChild(family, childId);
    return success(
      Object.values(family.reports)
        .filter((report) => report.child_id === childId)
        .sort((a, b) => a.measurement_date.localeCompare(b.measurement_date)),
      traceId,
    );
  }

  @Get("assessment/trends")
  async getTrends(
    @Query("child_id") childId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = requireAccountContext(request);
    const family = await loadFamilyStore(context.family_id);
    requireFamilyChild(family, childId);
    return success(
      {
        child_id: childId,
        points: Object.values(family.reports)
          .filter((report) => report.child_id === childId)
          .map((report) => ({
            report_id: report.id,
            measurement_date: report.measurement_date,
            total_score: report.total_score,
          })),
      },
      traceId,
    );
  }

  @Get("assessment/sessions/:sessionId/trace")
  async getTrace(
    @Param("sessionId") sessionId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = requireAccountContext(request);
    const family = await loadFamilyStore(context.family_id);
    const session = family.assessmentSessions[sessionId];
    if (!session)
      resourceNotFound("ASSESSMENT_SESSION_NOT_FOUND", "体测任务不存在。");
    requireFamilyChild(family, session.child_id);
    const report = session.report_id
      ? family.reports[session.report_id]
      : undefined;
    if (!report) return success({ session_id: session.id, trace: [] }, traceId);
    return success(
      {
        session_id: session.id,
        trace: report.results.map((result) => ({
          indicator_code: result.indicator_code,
          raw_value: result.raw_value,
          score: result.score,
          weight: result.weight,
          contribution: result.contribution,
          algorithm_version: report.algorithm_version,
          knowledge_snapshot_id: report.knowledge_snapshot_id,
        })),
      },
      traceId,
    );
  }

  @Get("reports")
  async getReports(
    @Query("child_id") childId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = requireAccountContext(request);
    const family = await loadFamilyStore(context.family_id);
    requireFamilyChild(family, childId);
    return success(
      Object.values(family.reports).filter(
        (report) => report.child_id === childId,
      ),
      traceId,
    );
  }

  @Get("reports/:reportId")
  async getReport(
    @Param("reportId") reportId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = requireAccountContext(request);
    const family = await loadFamilyStore(context.family_id);
    const report = family.reports[reportId];
    if (!report)
      resourceNotFound("ASSESSMENT_REPORT_NOT_FOUND", "报告不存在。");
    requireFamilyChild(family, report.child_id);
    return success(report, traceId);
  }
}
