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
  assessmentSessions,
  createAssessmentReport,
  getAssessmentSchema,
  getChild,
  reports,
  DEMO_STANDARD_VERSION,
  persistStore,
} from "./demo-store.js";
import { success } from "./http.js";
import { parseInput } from "./validation.js";
import {
  assertChildAccess,
  guardianContext,
  resourceNotFound,
} from "./auth.js";

@Controller()
export class AssessmentController {
  @Get("assessment/schemas")
  getSchema(
    @Query("child_id") childId: string,
    @Query("measurement_date")
    measurementDate = new Date().toISOString().slice(0, 10),
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    assertChildAccess(request, childId);
    const child = getChild(childId);
    if (!child) resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
    return success(getAssessmentSchema(child, measurementDate), traceId);
  }

  @Post("assessment/sessions")
  createSession(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const input = parseInput(createAssessmentSessionRequestSchema, body);
    assertChildAccess(request, input.child_id);
    const child = getChild(input.child_id);
    if (!child) resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
    const schema = getAssessmentSchema(child, input.measurement_date);
    if (
      input.standard_version_id !== schema.standard_version_id &&
      input.standard_version_id !== DEMO_STANDARD_VERSION
    ) {
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
    assessmentSessions.set(id, session);
    void persistStore();
    return success(session, traceId);
  }

  @Get("assessment/sessions/:sessionId")
  getSession(
    @Param("sessionId") sessionId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const session = assessmentSessions.get(sessionId);
    if (!session)
      resourceNotFound("ASSESSMENT_SESSION_NOT_FOUND", "体测任务不存在。");
    assertChildAccess(request, session.child_id);
    return success(session, traceId);
  }

  @Patch("assessment/sessions/:sessionId")
  saveSession(
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const session = assessmentSessions.get(sessionId);
    if (!session)
      resourceNotFound("ASSESSMENT_SESSION_NOT_FOUND", "体测任务不存在。");
    assertChildAccess(request, session.child_id);
    const input = parseInput(saveAssessmentSessionRequestSchema, body);
    session.values = input.values;
    session.test_status = input.test_status;
    void persistStore();
    return success(session, traceId);
  }

  @Post("assessment/sessions/:sessionId/submit")
  submitSession(
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const session = assessmentSessions.get(sessionId);
    if (!session)
      resourceNotFound("ASSESSMENT_SESSION_NOT_FOUND", "体测任务不存在。");
    assertChildAccess(request, session.child_id);
    const input = parseInput(submitAssessmentRequestSchema, body);
    const child = getChild(session.child_id);
    if (!child) resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
    const schema = getAssessmentSchema(child, session.measurement_date);
    session.values = input.values;
    session.test_status = input.test_status;
    session.status = "validating";
    const report = createAssessmentReport(
      session.id,
      child,
      schema,
      session.values,
      session.test_status,
    );
    return success(report, traceId);
  }

  @Get("assessment/history")
  getHistory(
    @Query("child_id") childId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    assertChildAccess(request, childId);
    return success(
      [...reports.values()]
        .filter((report) => report.child_id === childId)
        .sort((a, b) => a.measurement_date.localeCompare(b.measurement_date)),
      traceId,
    );
  }

  @Get("assessment/trends")
  getTrends(
    @Query("child_id") childId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    assertChildAccess(request, childId);
    return success(
      {
        child_id: childId,
        points: [...reports.values()]
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
  getTrace(
    @Param("sessionId") sessionId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const session = assessmentSessions.get(sessionId);
    if (!session)
      resourceNotFound("ASSESSMENT_SESSION_NOT_FOUND", "体测任务不存在。");
    assertChildAccess(request, session.child_id);
    const report = session.report_id
      ? reports.get(session.report_id)
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
  getReports(
    @Query("child_id") childId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    assertChildAccess(request, childId);
    return success(
      [...reports.values()].filter((report) => report.child_id === childId),
      traceId,
    );
  }

  @Get("reports/:reportId")
  getReport(
    @Param("reportId") reportId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const report = reports.get(reportId);
    if (!report)
      resourceNotFound("ASSESSMENT_REPORT_NOT_FOUND", "报告不存在。");
    assertChildAccess(request, report.child_id);
    return success(report, traceId);
  }
}
