import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  ForbiddenException,
  Req,
  Patch,
} from "@nestjs/common";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import {
  trainingCheckInRequestSchema,
  trainingPauseRequestSchema,
  trainingResumeRequestSchema,
} from "@boks/contracts";
import { createTrainingPlanRequestSchema } from "@boks/contracts";
import {
  createTrainingPlan,
  getChild,
  trainingPlans,
  persistStore,
  store,
  reports,
} from "./demo-store.js";
import { success } from "./http.js";
import { parseInput } from "./validation.js";
import {
  assertChildAccess,
  guardianContext,
  resourceForbidden,
  resourceNotFound,
} from "./auth.js";

@Controller("training")
export class TrainingController {
  @Get("plans")
  listPlans(
    @Req() request: Request,
    @Query("child_id") childId?: string,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    if (childId) assertChildAccess(request, childId);
    const plans = [...trainingPlans.values()].filter((plan) => {
      if (childId !== undefined) return plan.child_id === childId;
      return (
        context.family_id === store.family_id &&
        Boolean(getChild(plan.child_id))
      );
    });
    return success(plans, traceId);
  }

  @Post("plans")
  createPlan(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const input = parseInput(createTrainingPlanRequestSchema, body);
    assertChildAccess(request, input.child_id);
    if (!getChild(input.child_id))
      resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
    if (input.source_report_id) {
      const sourceReport = reports.get(input.source_report_id);
      if (!sourceReport)
        resourceNotFound("ASSESSMENT_REPORT_NOT_FOUND", "来源报告不存在。");
      assertChildAccess(request, sourceReport.child_id);
      if (sourceReport.child_id !== input.child_id)
        resourceForbidden("RESOURCE_FORBIDDEN", "来源报告不属于当前儿童。");
    }
    const redFlagText =
      `${input.goal} ${input.red_flags.join(" ")}`.toLowerCase();
    if (
      input.health_safety_status === "paused_safety_review" ||
      /疼痛|麻木|无力|夜间疼痛|呼吸困难|急症/.test(redFlagText)
    ) {
      throw new ForbiddenException({
        error: {
          code: "PAUSED_SAFETY_REVIEW",
          message: "检测到安全红旗，请停止训练并由监护人安排人工复核。",
          details: [],
          retryable: false,
        },
      });
    }
    return success(
      createTrainingPlan(
        input.child_id,
        input.source_report_id,
        input.goal,
        input.duration_weeks,
        input.days_per_week,
        input.minutes_per_session,
      ),
      traceId,
    );
  }

  @Get("plans/:planId")
  getPlan(
    @Param("planId") planId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const plan = trainingPlans.get(planId);
    if (!plan) resourceNotFound("TRAINING_PLAN_NOT_FOUND", "训练计划不存在。");
    assertChildAccess(request, plan.child_id);
    return success(plan, traceId);
  }

  @Get("plans/:planId/days/:day")
  getDay(
    @Param("planId") planId: string,
    @Param("day") day: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const plan = trainingPlans.get(planId);
    if (!plan) resourceNotFound("TRAINING_PLAN_NOT_FOUND", "训练计划不存在。");
    assertChildAccess(request, plan.child_id);
    return success(
      {
        plan_id: planId,
        day: Number(day),
        items: plan.items.filter((item) => item.day === Number(day)),
        check_ins: Object.values(store.checkIns).filter(
          (item) => item.plan_id === planId && item.day === Number(day),
        ),
      },
      traceId,
    );
  }

  @Post("plans/:planId/check-ins")
  checkIn(
    @Param("planId") planId: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const plan = trainingPlans.get(planId);
    if (!plan) resourceNotFound("TRAINING_PLAN_NOT_FOUND", "训练计划不存在。");
    assertChildAccess(request, plan.child_id);
    const input = parseInput(trainingCheckInRequestSchema, body);
    const checkIn = {
      id: randomUUID(),
      plan_id: planId,
      child_id: plan.child_id,
      day: input.day,
      status: input.status,
      note: input.note,
      created_at: new Date().toISOString(),
    };
    store.checkIns[checkIn.id] = checkIn;
    void persistStore();
    return success(checkIn, traceId);
  }

  @Get("plans/:planId/progress")
  progress(
    @Param("planId") planId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const plan = trainingPlans.get(planId);
    if (!plan) resourceNotFound("TRAINING_PLAN_NOT_FOUND", "训练计划不存在。");
    assertChildAccess(request, plan.child_id);
    const checks = Object.values(store.checkIns).filter(
      (item) => item.plan_id === planId,
    );
    return success(
      {
        plan_id: planId,
        completed: checks.filter((item) => item.status === "completed").length,
        skipped: checks.filter((item) => item.status === "skipped").length,
        total_days: plan.duration_weeks * plan.days_per_week,
        status: plan.status,
      },
      traceId,
    );
  }

  @Post("plans/:planId/pause")
  pause(
    @Param("planId") planId: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const plan = trainingPlans.get(planId);
    if (!plan) resourceNotFound("TRAINING_PLAN_NOT_FOUND", "训练计划不存在。");
    assertChildAccess(request, plan.child_id);
    const input = parseInput(trainingPauseRequestSchema, body);
    plan.status = "paused_safety_review";
    void persistStore();
    return success(
      { plan, reason: input.reason, code: "paused_safety_review" },
      traceId,
    );
  }

  @Post("plans/:planId/resume")
  resume(
    @Param("planId") planId: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    guardianContext(request);
    const plan = trainingPlans.get(planId);
    if (!plan) resourceNotFound("TRAINING_PLAN_NOT_FOUND", "训练计划不存在。");
    assertChildAccess(request, plan.child_id);
    parseInput(trainingResumeRequestSchema, body);
    plan.status = "active";
    void persistStore();
    return success(plan, traceId);
  }
}
