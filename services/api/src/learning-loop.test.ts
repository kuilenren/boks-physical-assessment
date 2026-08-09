import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as db from "./demo-store.js";
import {
  contentHash,
  syncAllKnowledgeSources,
  syncKnowledgeSource,
} from "./knowledge-sync.js";
import { buildFamilyNextActions, buildNextActions } from "./learning-loop.js";

const testFile = join(process.cwd(), "data", "boks-store.json");
afterAll(() => {
  if (existsSync(testFile)) rmSync(testFile);
});

beforeEach(() => db.resetDemoStore());

describe("knowledge auto-sync", () => {
  it("computes a stable content hash", () => {
    expect(contentHash("abc")).toBe(contentHash("abc"));
    expect(contentHash("abc")).not.toBe(contentHash("abd"));
  });

  it("creates a candidate version when source content changes", async () => {
    let content = "版本一";
    const source = (
      await db.updatePlatformStore((platform) => {
        const item = {
          id: "src-sync-1",
          title: "体测安全说明",
          owner: "BOKS",
          fetch_url: "https://example.gov.cn/safety",
          content_hash: null,
          created_at: new Date().toISOString(),
        };
        platform.knowledgeSources[item.id] = item;
        return platform;
      })
    ).knowledgeSources["src-sync-1"];
    expect(source.fetch_url).toBe("https://example.gov.cn/safety");

    const result = await syncKnowledgeSource("src-sync-1", async () => content);
    expect(result.status).toBe("updated");

    const platform = await db.loadPlatformStore();
    const versions = Object.values(platform.knowledgeVersions).filter(
      (item) => item.source_id === "src-sync-1",
    );
    expect(versions.length).toBe(1);
    expect(versions[0].status).toBe("candidate");
    expect(versions[0].content_hash).toBe(contentHash("版本一"));

    content = "版本二";
    const second = await syncKnowledgeSource("src-sync-1", async () => content);
    expect(second.status).toBe("updated");
    expect(
      Object.values((await db.loadPlatformStore()).knowledgeVersions).filter(
        (item) => item.source_id === "src-sync-1",
      ).length,
    ).toBe(2);
  });

  it("skips when content hash is unchanged", async () => {
    await db.updatePlatformStore((platform) => {
      platform.knowledgeSources["src-sync-2"] = {
        id: "src-sync-2",
        title: "稳定来源",
        owner: "BOKS",
        fetch_url: "https://example.gov.cn/stable",
        content_hash: null,
        created_at: new Date().toISOString(),
      };
    });
    await syncKnowledgeSource("src-sync-2", async () => "同样的内容");
    const result = await syncKnowledgeSource(
      "src-sync-2",
      async () => "同样的内容",
    );
    expect(result.status).toBe("unchanged");
    const versions = Object.values(
      (await db.loadPlatformStore()).knowledgeVersions,
    ).filter((item) => item.source_id === "src-sync-2");
    expect(versions.length).toBe(1);
  });

  it("returns failed status when source lacks a fetch url", async () => {
    const result = await syncKnowledgeSource("missing-source");
    expect(result.status).toBe("failed");
  });

  it("syncs all configured sources via syncAllKnowledgeSources", async () => {
    await db.updatePlatformStore((platform) => {
      platform.knowledgeSources["src-sync-a"] = {
        id: "src-sync-a",
        title: "来源 A",
        owner: "BOKS",
        fetch_url: "https://example.gov.cn/a",
        content_hash: null,
        created_at: new Date().toISOString(),
      };
      platform.knowledgeSources["src-sync-b"] = {
        id: "src-sync-b",
        title: "来源 B",
        owner: "BOKS",
        fetch_url: null,
        content_hash: null,
        created_at: new Date().toISOString(),
      };
    });
    const results = await syncAllKnowledgeSources(async () => "抓取到的内容");
    expect(results).toHaveLength(1);
    expect(results[0].source_id).toBe("src-sync-a");
    expect(results[0].status).toBe("updated");
  });

  it("never auto-publishes fetched candidates", async () => {
    await db.updatePlatformStore((platform) => {
      platform.knowledgeSources["src-sync-3"] = {
        id: "src-sync-3",
        title: "来源",
        owner: "BOKS",
        fetch_url: "https://example.gov.cn/x",
        content_hash: null,
        created_at: new Date().toISOString(),
      };
    });
    await syncKnowledgeSource("src-sync-3", async () => "新内容");
    const platform = await db.loadPlatformStore();
    expect(
      Object.values(platform.knowledgeVersions).every(
        (item) => item.status !== "published",
      ),
    ).toBe(true);
  });
});

describe("learning loop next-actions", () => {
  it("prompts for consent and first assessment when no data", () => {
    const child = db.buildChild({
      display_name: "测试儿童",
      birth_date: "2018-01-01",
      sex_code: "female",
      school_stage: "primary",
      grade_code: "2",
    });
    const actions = buildNextActions({
      child,
      reports: [],
      plans: [],
      checkIns: [],
      consents: [],
      hasPostureReport: false,
    });
    const categories = actions.map((item) => item.category);
    expect(categories).toContain("consent");
    expect(categories).toContain("assessment");
    expect(categories).toContain("posture");
  });

  it("suggests training plan when report exists but no plan", () => {
    const child = db.buildChild({
      display_name: "测试儿童",
      birth_date: "2018-01-01",
      sex_code: "female",
      school_stage: "primary",
      grade_code: "2",
    });
    const report = {
      id: "report-1",
      report_type: "assessment" as const,
      child_id: child.id,
      status: "ready" as const,
      measurement_date: "2026-07-01",
      standard_version_id: "std-1",
      standard_name: "国家 2014 标准",
      standard_status: "approved" as const,
      algorithm_version: "1.0",
      knowledge_snapshot_id: "ks",
      mode: "scored" as const,
      total_score: 84.8,
      level: "good" as const,
      completeness: 1,
      priority_actions: [],
      results: [],
      limitations: [],
      source_references: [],
      generated_at: new Date().toISOString(),
    };
    const actions = buildNextActions({
      child,
      reports: [report],
      plans: [],
      checkIns: [],
      consents: [
        {
          id: "c1",
          family_id: "family-test",
          child_id: child.id,
          purpose: "privacy" as const,
          version: "v1",
          granted: true,
          granted_at: new Date().toISOString(),
          withdrawn_at: null,
        },
        {
          id: "c2",
          family_id: "family-test",
          child_id: child.id,
          purpose: "assessment" as const,
          version: "v1",
          granted: true,
          granted_at: new Date().toISOString(),
          withdrawn_at: null,
        },
      ],
      hasPostureReport: true,
    });
    const training = actions.find((item) => item.category === "training");
    expect(training).toBeDefined();
    expect(training?.title).toBe("生成训练计划");
  });

  it("sorts actions by priority ascending", () => {
    const child = db.buildChild({
      display_name: "测试儿童",
      birth_date: "2018-01-01",
      sex_code: "female",
      school_stage: "primary",
      grade_code: "2",
    });
    const actions = buildNextActions({
      child,
      reports: [],
      plans: [],
      checkIns: [],
      consents: [],
      hasPostureReport: false,
    });
    for (let i = 1; i < actions.length; i++)
      expect(actions[i].priority).toBeGreaterThanOrEqual(
        actions[i - 1].priority,
      );
  });

  it("builds actions for multiple children via buildFamilyNextActions", () => {
    const childA = db.buildChild({
      display_name: "儿童 A",
      birth_date: "2017-01-01",
      sex_code: "male",
      school_stage: "primary",
      grade_code: "3",
    });
    const childB = db.buildChild({
      display_name: "儿童 B",
      birth_date: "2018-06-01",
      sex_code: "female",
      school_stage: "primary",
      grade_code: "1",
    });
    const actions = buildFamilyNextActions([
      {
        child: childA,
        reports: [],
        plans: [],
        checkIns: [],
        consents: [],
        hasPostureReport: false,
      },
      {
        child: childB,
        reports: [],
        plans: [],
        checkIns: [],
        consents: [],
        hasPostureReport: false,
      },
    ]);
    const childIds = new Set(actions.map((item) => item.child_id));
    expect(childIds.size).toBe(2);
  });

  it("respects vi environment for report staleness path", () => {
    const child = db.buildChild({
      display_name: "测试儿童",
      birth_date: "2018-01-01",
      sex_code: "female",
      school_stage: "primary",
      grade_code: "2",
    });
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const report = {
      id: "report-old",
      report_type: "assessment" as const,
      child_id: child.id,
      status: "ready" as const,
      measurement_date: "2025-01-01",
      standard_version_id: "std-1",
      standard_name: "国家 2014 标准",
      standard_status: "approved" as const,
      algorithm_version: "1.0",
      knowledge_snapshot_id: "ks",
      mode: "scored" as const,
      total_score: 84.8,
      level: "good" as const,
      completeness: 1,
      priority_actions: [],
      results: [],
      limitations: [],
      source_references: [],
      generated_at: old,
    };
    const actions = buildNextActions({
      child,
      reports: [report],
      plans: [],
      checkIns: [],
      consents: [
        {
          id: "c1",
          family_id: "family-test",
          child_id: child.id,
          purpose: "privacy" as const,
          version: "v1",
          granted: true,
          granted_at: new Date().toISOString(),
          withdrawn_at: null,
        },
        {
          id: "c2",
          family_id: "family-test",
          child_id: child.id,
          purpose: "assessment" as const,
          version: "v1",
          granted: true,
          granted_at: new Date().toISOString(),
          withdrawn_at: null,
        },
      ],
      hasPostureReport: true,
    });
    expect(
      actions.some(
        (item) => item.category === "assessment" && item.reason.includes("180"),
      ),
    ).toBe(true);
  });
});
