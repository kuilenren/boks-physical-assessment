import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Patch,
  Query,
  NotFoundException,
} from "@nestjs/common";
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
} from "./demo-store.js";
import { success } from "./http.js";
import { parseInput } from "./validation.js";

@Controller()
export class AssessmentController {
  @Get("assessment/schemas")
  getSchema(
    @Query("child_id") childId: string,
    @Query("measurement_date")
    measurementDate = new Date().toISOString().slice(0, 10),
    @Headers("x-trace-id") traceId?: string,
  ) {
    const child = getChild(childId);
    if (!child) throw new NotFoundException("儿童档案不存在。");
    return success(getAssessmentSchema(child, measurementDate), traceId);
  }

  @Post("assessment/sessions")
  createSession(
    @Body() body: unknown,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const input = parseInput(createAssessmentSessionRequestSchema, body);
    const child = getChild(input.child_id);
    if (!child) throw new NotFoundException("儿童档案不存在。");
    const schema = getAssessmentSchema(child, input.measurement_date);
    if (
      input.standard_version_id !== schema.standard_version_id &&
      input.standard_version_id !== DEMO_STANDARD_VERSION
    ) {
      throw new NotFoundException("标准版本不存在或不适用于当前儿童。");
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
    return success(session, traceId);
  }

  @Get("assessment/sessions/:sessionId")
  getSession(
    @Param("sessionId") sessionId: string,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const session = assessmentSessions.get(sessionId);
    if (!session) throw new NotFoundException("体测任务不存在。");
    return success(session, traceId);
  }

  @Patch("assessment/sessions/:sessionId")
  saveSession(
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const session = assessmentSessions.get(sessionId);
    if (!session) throw new NotFoundException("体测任务不存在。");
    const input = parseInput(saveAssessmentSessionRequestSchema, body);
    session.values = input.values;
    session.test_status = input.test_status;
    return success(session, traceId);
  }

  @Post("assessment/sessions/:sessionId/submit")
  submitSession(
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const session = assessmentSessions.get(sessionId);
    if (!session) throw new NotFoundException("体测任务不存在。");
    const input = parseInput(submitAssessmentRequestSchema, body);
    const child = getChild(session.child_id);
    if (!child) throw new NotFoundException("儿童档案不存在。");
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

  @Get("assessment/sessions/:sessionId/trace")
  getTrace(
    @Param("sessionId") sessionId: string,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const session = assessmentSessions.get(sessionId);
    if (!session) throw new NotFoundException("体测任务不存在。");
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
    @Headers("x-trace-id") traceId?: string,
  ) {
    return success(
      [...reports.values()].filter((report) => report.child_id === childId),
      traceId,
    );
  }

  @Get("reports/:reportId")
  getReport(
    @Param("reportId") reportId: string,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const report = reports.get(reportId);
    if (!report) throw new NotFoundException("报告不存在。");
    return success(report, traceId);
  }
}
