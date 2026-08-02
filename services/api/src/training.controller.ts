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
  loadFamilyStore,
  updateFamilyStore,
} from "./demo-store.js";
import { success } from "./http.js";
import { parseInput } from "./validation.js";
import {
  guardianContext,
  resourceForbidden,
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

@Controller("training")
export class TrainingController {
  @Get("plans")
  async listPlans(
    @Req() request: Request,
    @Query("child_id") childId?: string,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const plans = Object.values(family.trainingPlans).filter((plan) => {
      if (childId !== undefined)
        return (
          plan.child_id === childId &&
          Boolean(
            family.children.find(
              (child) =>
                child.id === childId && child.profile_status === "active",
            ),
          )
        );
      return Boolean(
        family.children.find(
          (child) =>
            child.id === plan.child_id && child.profile_status === "active",
        ),
      );
    });
    if (childId) requireFamilyChild(family, childId);
    return success(plans, traceId);
  }

  @Post("plans")
  async createPlan(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const input = parseInput(createTrainingPlanRequestSchema, body);
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    requireFamilyChild(family, input.child_id);
    if (input.source_report_id) {
      const sourceReport = family.reports[input.source_report_id];
      if (!sourceReport)
        resourceNotFound("ASSESSMENT_REPORT_NOT_FOUND", "来源报告不存在。");
      requireFamilyChild(family, sourceReport.child_id);
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
    let plan: ReturnType<typeof createTrainingPlan> | undefined;
    await updateFamilyStore(context.family_id, (next) => {
      plan = createTrainingPlan(
        input.child_id,
        input.source_report_id,
        input.goal,
        input.duration_weeks,
        input.days_per_week,
        input.minutes_per_session,
        next,
      );
    });
    if (!plan) throw new Error("训练计划创建失败。");
    return success(plan, traceId);
  }

  @Get("plans/:planId")
  async getPlan(
    @Param("planId") planId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const plan = family.trainingPlans[planId];
    if (!plan) resourceNotFound("TRAINING_PLAN_NOT_FOUND", "训练计划不存在。");
    requireFamilyChild(family, plan.child_id);
    return success(plan, traceId);
  }

  @Get("plans/:planId/days/:day")
  async getDay(
    @Param("planId") planId: string,
    @Param("day") day: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const plan = family.trainingPlans[planId];
    if (!plan) resourceNotFound("TRAINING_PLAN_NOT_FOUND", "训练计划不存在。");
    requireFamilyChild(family, plan.child_id);
    return success(
      {
        plan_id: planId,
        day: Number(day),
        items: plan.items.filter((item) => item.day === Number(day)),
        check_ins: Object.values(family.checkIns).filter(
          (item) => item.plan_id === planId && item.day === Number(day),
        ),
      },
      traceId,
    );
  }

  @Post("plans/:planId/check-ins")
  async checkIn(
    @Param("planId") planId: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const plan = family.trainingPlans[planId];
    if (!plan) resourceNotFound("TRAINING_PLAN_NOT_FOUND", "训练计划不存在。");
    requireFamilyChild(family, plan.child_id);
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
    await updateFamilyStore(context.family_id, (next) => {
      next.checkIns[checkIn.id] = checkIn;
    });
    return success(checkIn, traceId);
  }

  @Get("plans/:planId/progress")
  async progress(
    @Param("planId") planId: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const plan = family.trainingPlans[planId];
    if (!plan) resourceNotFound("TRAINING_PLAN_NOT_FOUND", "训练计划不存在。");
    requireFamilyChild(family, plan.child_id);
    const checks = Object.values(family.checkIns).filter(
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
  async pause(
    @Param("planId") planId: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const plan = family.trainingPlans[planId];
    if (!plan) resourceNotFound("TRAINING_PLAN_NOT_FOUND", "训练计划不存在。");
    requireFamilyChild(family, plan.child_id);
    const input = parseInput(trainingPauseRequestSchema, body);
    await updateFamilyStore(context.family_id, (next) => {
      const target = next.trainingPlans[planId];
      if (!target)
        resourceNotFound("TRAINING_PLAN_NOT_FOUND", "训练计划不存在。");
      target.status = "paused_safety_review";
    });
    plan.status = "paused_safety_review";
    return success(
      { plan, reason: input.reason, code: "paused_safety_review" },
      traceId,
    );
  }

  @Post("plans/:planId/resume")
  async resume(
    @Param("planId") planId: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const context = guardianContext(request);
    const family = await loadFamilyStore(context.family_id);
    const plan = family.trainingPlans[planId];
    if (!plan) resourceNotFound("TRAINING_PLAN_NOT_FOUND", "训练计划不存在。");
    requireFamilyChild(family, plan.child_id);
    parseInput(trainingResumeRequestSchema, body);
    await updateFamilyStore(context.family_id, (next) => {
      const target = next.trainingPlans[planId];
      if (!target)
        resourceNotFound("TRAINING_PLAN_NOT_FOUND", "训练计划不存在。");
      target.status = "active";
    });
    plan.status = "active";
    return success(plan, traceId);
  }
}
