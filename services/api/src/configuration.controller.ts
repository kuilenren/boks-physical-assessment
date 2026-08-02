import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import {
  findStandard,
  getConfiguration,
  loadPlatformStore,
  updatePlatformStore,
  type StandardConfiguration,
  type ScoreBand,
} from "./demo-store.js";
import { success } from "./http.js";
import { adminReviewer, resourceNotFound } from "./auth.js";

function isScoreBand(value: unknown): value is ScoreBand {
  if (typeof value !== "object" || value === null) return false;
  const band = value as Partial<ScoreBand>;
  return (
    (band.min === null ||
      (typeof band.min === "number" && Number.isFinite(band.min))) &&
    (band.max === null ||
      (typeof band.max === "number" && Number.isFinite(band.max))) &&
    typeof band.score === "number" &&
    Number.isFinite(band.score) &&
    band.score >= 0 &&
    band.score <= 100
  );
}

function parseStandard(body: unknown): StandardConfiguration {
  if (typeof body !== "object" || body === null)
    throw new BadRequestException({
      error: {
        code: "INVALID_CONFIGURATION",
        message: "配置格式不符合要求。",
        details: [],
        retryable: false,
      },
    });
  const candidate = body as Partial<StandardConfiguration>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    !Array.isArray(candidate.indicators) ||
    !Array.isArray(candidate.rules) ||
    !Array.isArray(candidate.source_references) ||
    (candidate.mode !== "scored" && candidate.mode !== "reference_only")
  )
    throw new BadRequestException({
      error: {
        code: "INVALID_CONFIGURATION",
        message: "配置格式不符合要求。",
        details: [],
        retryable: false,
      },
    });
  const indicators = candidate.indicators.filter(
    (indicator): indicator is StandardConfiguration["indicators"][number] =>
      typeof indicator === "object" &&
      indicator !== null &&
      typeof indicator.indicator_code === "string" &&
      indicator.indicator_code.length > 0 &&
      typeof indicator.label === "string" &&
      indicator.label.length > 0 &&
      typeof indicator.unit === "string" &&
      indicator.unit.length > 0 &&
      (indicator.input_type === "decimal" ||
        indicator.input_type === "integer") &&
      Number.isFinite(indicator.min_value) &&
      Number.isFinite(indicator.max_value) &&
      indicator.max_value > indicator.min_value &&
      Number.isFinite(indicator.step) &&
      indicator.step > 0 &&
      typeof indicator.required === "boolean" &&
      typeof indicator.help_text === "string" &&
      indicator.help_text.length > 0,
  );
  const indicatorCodes = new Set(
    indicators.map((indicator) => indicator.indicator_code),
  );
  if (
    indicators.length !== candidate.indicators.length ||
    indicatorCodes.size !== indicators.length
  )
    throw new BadRequestException({
      error: {
        code: "INVALID_CONFIGURATION",
        message: "体测指标必须包含唯一且完整的输入定义。",
        details: [],
        retryable: false,
      },
    });
  const rules = candidate.rules.filter(
    (rule): rule is StandardConfiguration["rules"][number] =>
      typeof rule === "object" &&
      rule !== null &&
      typeof rule.indicator_code === "string" &&
      (rule.score_type === "higher_is_better" ||
        rule.score_type === "lower_is_better") &&
      Number.isFinite(rule.baseline) &&
      Number.isFinite(rule.points_per_unit) &&
      Number.isFinite(rule.weight) &&
      rule.weight >= 0 &&
      rule.weight <= 1 &&
      (rule.score_bands === undefined ||
        (Array.isArray(rule.score_bands) &&
          rule.score_bands.every(isScoreBand))),
  );
  if (
    rules.length !== candidate.rules.length ||
    rules.some((rule) => !indicatorCodes.has(rule.indicator_code))
  )
    throw new BadRequestException({
      error: {
        code: "INVALID_CONFIGURATION",
        message: "评分规则必须包含合法的方向、权重和分档。",
        details: [],
        retryable: false,
      },
    });
  const sourceReferences = candidate.source_references.filter(
    (reference) =>
      typeof reference === "object" &&
      reference !== null &&
      typeof reference.title === "string" &&
      typeof reference.official_url === "string",
  );
  if (sourceReferences.length !== candidate.source_references.length)
    throw new BadRequestException({
      error: {
        code: "INVALID_CONFIGURATION",
        message: "标准来源必须包含标题和官方链接。",
        details: [],
        retryable: false,
      },
    });
  return {
    ...candidate,
    indicators,
    status: "demo_pending_review",
    mode: candidate.mode,
    rules,
    source_references: sourceReferences,
    reviewers: [],
  } as StandardConfiguration;
}
@Controller("configuration")
export class ConfigurationController {
  @Get("assessment") async getAssessmentConfiguration(
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    adminReviewer(request);
    const platform = await loadPlatformStore();
    return success(getConfiguration(platform), traceId);
  }
  @Patch("assessment") async update(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const actor = adminReviewer(request);
    const candidate = parseStandard(body);
    let updated: StandardConfiguration;
    await updatePlatformStore((platform) => {
      const previous = platform.configuration.candidates.find(
        (item) => item.id === candidate.id,
      );
      updated = { ...candidate, reviewers: previous?.reviewers ?? [] };
      platform.configuration.candidates = [
        ...platform.configuration.candidates.filter(
          (item) => item.id !== candidate.id,
        ),
        updated,
      ];
      platform.auditEvents.push({
        id: randomUUID(),
        action: "configuration.candidate",
        actor,
        created_at: new Date().toISOString(),
      });
    });
    return success(updated!, traceId);
  }
  @Post("assessment/candidates/:id/review") async review(
    @Param("id") id: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const actor = adminReviewer(request);
    let updated: StandardConfiguration;
    await updatePlatformStore((platform) => {
      const candidate = platform.configuration.candidates.find(
        (item) => item.id === id,
      );
      if (!candidate)
        resourceNotFound("CONFIGURATION_NOT_FOUND", "候选配置不存在。");
      if (!candidate.reviewers.includes(actor)) candidate.reviewers.push(actor);
      platform.auditEvents.push({
        id: randomUUID(),
        action: "configuration.review",
        actor,
        created_at: new Date().toISOString(),
      });
      updated = candidate;
    });
    return success(updated!, traceId);
  }
  @Post("assessment/candidates/:id/publish") async publish(
    @Param("id") id: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const actor = adminReviewer(request);
    let updated: StandardConfiguration;
    await updatePlatformStore((platform) => {
      const candidate = platform.configuration.candidates.find(
        (item) => item.id === id,
      );
      if (!candidate)
        resourceNotFound("CONFIGURATION_NOT_FOUND", "候选配置不存在。");
      if (new Set(candidate.reviewers).size < 2)
        throw new BadRequestException({
          error: {
            code: "TWO_REVIEWERS_REQUIRED",
            message: "发布至少需要两名不同审核者。",
            details: [],
            retryable: false,
          },
        });
      candidate.status = "approved";
      platform.configuration.history.push(
        ...platform.configuration.standards.filter((item) => item.id === id),
      );
      platform.configuration.standards = [
        ...platform.configuration.standards.filter((item) => item.id !== id),
        candidate,
      ];
      platform.configuration.active_standard_id = candidate.id;
      platform.configuration.candidates =
        platform.configuration.candidates.filter((item) => item.id !== id);
      platform.auditEvents.push({
        id: randomUUID(),
        action: "configuration.publish",
        actor,
        created_at: new Date().toISOString(),
      });
      updated = candidate;
    });
    return success(updated!, traceId);
  }
  @Post("assessment/:id/rollback") async rollback(
    @Param("id") id: string,
    @Req() request: Request,
    @Headers("x-trace-id") traceId?: string,
  ) {
    adminReviewer(request);
    let updated: StandardConfiguration;
    await updatePlatformStore((platform) => {
      const item = findStandard(id, platform);
      if (!item) resourceNotFound("CONFIGURATION_NOT_FOUND", "配置不存在。");
      platform.configuration.active_standard_id = item.id;
      updated = item;
    });
    return success(updated!, traceId);
  }
}
