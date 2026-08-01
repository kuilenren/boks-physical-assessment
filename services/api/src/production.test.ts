import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as db from "./demo-store.js";
import * as auth from "./auth.js";
import * as knowledge from "./knowledge.controller.js";
import * as chat from "./chat.controller.js";
import * as training from "./training.controller.js";

const testFile = join(process.cwd(), "data", "boks-store.json");
afterAll(() => {
  if (existsSync(testFile)) rmSync(testFile);
});

beforeAll(() => db.resetDemoStore());

describe("production safety boundaries", () => {
  it("persists the seeded store through an atomic write", async () => {
    await db.persistStore();
    expect(existsSync(testFile)).toBe(true);
    const child = db.getChild("child-demo-001");
    expect(child?.display_name).toBe("小朋友");
  });

  it("scores configured run, reach and rope rules", () => {
    const child = db.getChild("child-demo-001");
    if (!child) throw new Error("seed missing");
    const schema = db.getAssessmentSchema(child, "2026-08-02");
    const result = db.calculateResults(
      schema,
      [
        { indicator_code: "run_50m", raw_value: "10", unit: "秒" },
        { indicator_code: "sit_reach", raw_value: "15", unit: "厘米" },
        { indicator_code: "rope_1min", raw_value: "100", unit: "次" },
      ],
      "completed",
    );
    expect(result.totalScore).not.toBeNull();
    expect(
      result.results.every(
        (item) =>
          item.score !== null ||
          item.indicator_code === "height" ||
          item.indicator_code === "weight",
      ),
    ).toBe(true);
  });

  it("rejects photo use without an active consent", () => {
    const request = { headers: {} } as import("express").Request;
    expect(() =>
      auth.requireConsent(request, "child-demo-001", "photo"),
    ).toThrow();
  });

  it("requires two distinct reviewers before knowledge publish", () => {
    const controller = new knowledge.KnowledgeController();
    const request = (reviewer: string) =>
      ({
        headers: {
          "x-admin-token": "dev-admin-token",
          "x-admin-reviewer": reviewer,
        },
      }) as unknown as import("express").Request;
    const source = controller.source(
      { title: "安全训练", owner: "BOKS" },
      request("one"),
    ) as { data: { id: string } };
    const version = controller.version(
      {
        source_id: source.data.id,
        version: "1",
        title: "安全训练",
        content: "仅作健康教育。",
      },
      request("one"),
    ) as { data: { id: string } };
    expect(() => controller.publish(version.data.id, request("one"))).toThrow();
    controller.review(version.data.id, request("two"));
    expect(() =>
      controller.publish(version.data.id, request("two")),
    ).not.toThrow();
  });

  it("returns a stop-and-care message for red-flag chat", () => {
    const controller = new chat.ChatController();
    const request = { headers: {} } as import("express").Request;
    const conversation = controller.create(request) as { data: { id: string } };
    const response = controller.message(
      conversation.data.id,
      { content: "孩子训练后疼痛和麻木，可以诊断吗？" },
      request,
    ) as { data: { message: { content: string } } };
    expect(response.data.message.content).toContain("不能");
    expect(response.data.message.content).toContain("停止训练");
  });

  it("blocks a plan when a safety red flag is supplied", () => {
    const controller = new training.TrainingController();
    expect(() =>
      controller.createPlan(
        {
          child_id: "child-demo-001",
          goal: "耐力训练",
          duration_weeks: 4,
          days_per_week: 3,
          minutes_per_session: 20,
          safety_confirmed: true,
          health_safety_status: "clear",
          red_flags: ["夜间疼痛"],
        },
        { headers: {} } as unknown as import("express").Request,
      ),
    ).toThrow();
  });
});
