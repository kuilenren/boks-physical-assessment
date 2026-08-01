import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  NotFoundException,
} from "@nestjs/common";
import { createTrainingPlanRequestSchema } from "@boks/contracts";
import { createTrainingPlan, getChild, trainingPlans } from "./demo-store.js";
import { success } from "./http.js";
import { parseInput } from "./validation.js";

@Controller("training")
export class TrainingController {
  @Get("plans")
  listPlans(
    @Query("child_id") childId?: string,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const plans = [...trainingPlans.values()].filter(
      (plan) => childId === undefined || plan.child_id === childId,
    );
    return success(plans, traceId);
  }

  @Post("plans")
  createPlan(@Body() body: unknown, @Headers("x-trace-id") traceId?: string) {
    const input = parseInput(createTrainingPlanRequestSchema, body);
    if (!getChild(input.child_id)) {
      throw new NotFoundException("儿童档案不存在。");
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
    @Headers("x-trace-id") traceId?: string,
  ) {
    const plan = trainingPlans.get(planId);
    if (!plan) throw new NotFoundException("训练计划不存在。");
    return success(plan, traceId);
  }
}
