import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as db from "./demo-store.js";
import * as auth from "./auth.js";
import * as knowledge from "./knowledge.controller.js";
import * as chat from "./chat.controller.js";
import * as training from "./training.controller.js";
import * as configuration from "./configuration.controller.js";
import * as posture from "./posture.controller.js";
import { FamilyController } from "./family.controller.js";
import { assertRuntimeConfig } from "./runtime-config.js";
import { createPostureUploadUrl } from "./asset-storage.js";

const testFile = join(process.cwd(), "data", "boks-store.json");
const assetDirectory = join(process.cwd(), "data", "posture-assets");
afterAll(() => {
  if (existsSync(testFile)) rmSync(testFile);
  if (existsSync(assetDirectory))
    rmSync(assetDirectory, { recursive: true, force: true });
});

beforeEach(() => db.resetDemoStore());

describe("production safety boundaries", () => {
  it("persists the seeded store through an atomic write", async () => {
    await db.persistStore();
    expect(existsSync(testFile)).toBe(true);
    const child = db.getChild("child-demo-001");
    expect(child?.display_name).toBe("小朋友");
  });

  it("exports only the active children from the authenticated family", async () => {
    db.store.families["family-test-002"] = {
      id: "family-test-002",
      display_name: "另一个家庭",
      status: "active",
    };
    db.children.push({
      id: "child-test-002",
      family_id: "family-test-002",
      display_name: "另一个儿童",
      birth_date: "2019-05-01",
      age_in_months: 0,
      sex_code: "male",
      school_stage: "primary",
      grade_code: "grade_1",
      profile_status: "active",
    });
    const session = auth.createSession("guardian-demo-001");
    const request = {
      headers: { authorization: `Bearer ${session.token}` },
    } as unknown as import("express").Request;
    const response = (await new FamilyController().exportFamily(request)) as {
      data: { family_id: string; data: { children: Array<{ id: string }> } };
    };
    expect(response.data.family_id).toBe("family-demo-001");
    expect(response.data.data.children.map((child) => child.id)).toEqual([
      "child-demo-001",
    ]);
  });

  it("records a deletion proof after removing a child", async () => {
    const session = auth.createSession("guardian-demo-001");
    const request = {
      headers: { authorization: `Bearer ${session.token}` },
    } as unknown as import("express").Request;
    const response = (await new FamilyController().deleteChild(
      "child-demo-001",
      request,
    )) as {
      data: {
        status: string;
        deletion_proof: { proof_hash: string; deleted_asset_count: number };
      };
    };
    expect(response.data.status).toBe("deleted");
    expect(response.data.deletion_proof.proof_hash).toHaveLength(64);
    expect(response.data.deletion_proof.deleted_asset_count).toBe(0);
    expect(
      db.store.deletionRequests.find(
        (item) => item.child_id === "child-demo-001",
      ),
    ).toMatchObject({
      status: "completed",
      proof_hash: response.data.deletion_proof.proof_hash,
    });
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

  it("requires two distinct reviewers before knowledge publish", async () => {
    const controller = new knowledge.KnowledgeController();
    const request = (reviewer: string) =>
      ({
        headers: {
          "x-admin-token": "dev-admin-token",
          "x-admin-reviewer": reviewer,
        },
      }) as unknown as import("express").Request;
    const source = (await controller.source(
      { title: "安全训练", owner: "BOKS" },
      request("one"),
    )) as { data: { id: string } };
    const version = (await controller.version(
      {
        source_id: source.data.id,
        version: "1",
        title: "安全训练",
        content: "仅作健康教育。",
      },
      request("one"),
    )) as { data: { id: string } };
    await expect(
      controller.publish(version.data.id, request("one")),
    ).rejects.toThrow();
    await controller.review(version.data.id, request("two"));
    await expect(
      controller.publish(version.data.id, request("two")),
    ).resolves.not.toThrow();
  });

  it("returns a stop-and-care message for red-flag chat", async () => {
    const controller = new chat.ChatController();
    const request = { headers: {} } as import("express").Request;
    const conversation = (await controller.create(request)) as {
      data: { id: string };
    };
    const response = (await controller.message(
      conversation.data.id,
      { content: "孩子训练后疼痛和麻木，可以诊断吗？" },
      request,
    )) as { data: { message: { content: string } } };
    expect(response.data.message.content).toContain("不能");
    expect(response.data.message.content).toContain("停止训练");
  });

  it("blocks a plan when a safety red flag is supplied", async () => {
    const controller = new training.TrainingController();
    await expect(
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
    ).rejects.toThrow();
  });

  it("rotates refresh tokens and rejects revoked access tokens", () => {
    const session = auth.createSession("guardian-demo-001");
    const refreshed = auth.refreshSession(session.refresh_token);
    expect(refreshed.token).not.toBe(session.token);
    const request = {
      headers: { authorization: `Bearer ${refreshed.token}` },
    } as unknown as import("express").Request;
    expect(auth.guardianContext(request).guardian_id).toBe("guardian-demo-001");
    auth.revokeSession(request);
    expect(() => auth.guardianContext(request)).toThrow();
    expect(() => auth.refreshSession(session.refresh_token)).toThrow();
  });

  it("does not serialize raw authentication secrets into the JSON snapshot", async () => {
    const session = auth.createSession("guardian-demo-001");
    await db.persistStore();
    const snapshot = readFileSync(testFile, "utf8");
    expect(snapshot).not.toContain(session.token);
    expect(snapshot).not.toContain(session.refresh_token);
    expect(JSON.parse(snapshot).sessions).toEqual({});
  });

  it("requires two distinct reviewers before assessment configuration publish", async () => {
    const controller = new configuration.ConfigurationController();
    const request = (reviewer: string) =>
      ({
        headers: {
          "x-admin-token": "dev-admin-token",
          "x-admin-reviewer": reviewer,
        },
      }) as unknown as import("express").Request;
    const source = db.getConfiguration().standards[0];
    const candidate = {
      ...structuredClone(source),
      id: "assessment-candidate-test",
      status: "demo_pending_review" as const,
      reviewers: [],
    };
    await controller.update(candidate, request("one"));
    await expect(
      controller.publish(candidate.id, request("one")),
    ).rejects.toThrow();
    await controller.review(candidate.id, request("one"));
    await controller.review(candidate.id, request("two"));
    await expect(
      controller.publish(candidate.id, request("two")),
    ).resolves.not.toThrow();
    expect(db.findStandard(candidate.id)?.status).toBe("approved");
  });

  it("stores uploaded posture bytes with metadata", async () => {
    const consent = {
      id: "consent-test",
      family_id: db.store.family_id,
      child_id: "child-demo-001",
      purpose: "photo" as const,
      version: "test",
      granted: true,
      granted_at: new Date().toISOString(),
      withdrawn_at: null,
    };
    db.store.consents[consent.id] = consent;
    const controller = new posture.PostureController();
    const request = { headers: {} } as unknown as import("express").Request;
    const created = (await controller.createSession(
      {
        child_id: consent.child_id,
        consent_record_id: consent.id,
        capture_protocol_version: "test",
        required_views: ["front", "back", "left", "right"],
      },
      request,
    )) as { data: { id: string } };
    const bytes = Buffer.alloc(1024);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    bytes.writeUInt32BE(512, 16);
    bytes.writeUInt32BE(768, 20);
    await controller.uploadView(
      created.data.id,
      "front",
      {
        file_name: "front.png",
        mime_type: "image/png",
        size_bytes: bytes.length,
        content_base64: bytes.toString("base64"),
      },
      request,
    );
    const asset = Object.values(db.store.postureAssets)[0];
    expect(asset?.metadata.storage_status).toBe("uploaded");
    expect(asset?.metadata.checksum_sha256).toHaveLength(64);
    expect(asset?.metadata.quality_status).toBe("passed");
    expect(asset?.metadata.width_px).toBe(512);
  });

  it("creates a bounded private-object presigned upload request", () => {
    const keys = [
      "BOKS_RUNTIME_ENV",
      "BOKS_OBJECT_STORAGE_BUCKET",
      "BOKS_OBJECT_STORAGE_ENDPOINT",
      "BOKS_OBJECT_STORAGE_REGION",
      "BOKS_OBJECT_STORAGE_ACCESS_KEY",
      "BOKS_OBJECT_STORAGE_SECRET_KEY",
    ] as const;
    const previous = Object.fromEntries(
      keys.map((key) => [key, process.env[key]]),
    );
    try {
      process.env.BOKS_RUNTIME_ENV = "staging";
      process.env.BOKS_OBJECT_STORAGE_BUCKET = "boks-private";
      process.env.BOKS_OBJECT_STORAGE_ENDPOINT = "https://s3.example.test";
      process.env.BOKS_OBJECT_STORAGE_REGION = "auto";
      process.env.BOKS_OBJECT_STORAGE_ACCESS_KEY = "test-access";
      process.env.BOKS_OBJECT_STORAGE_SECRET_KEY = "test-secret";
      const upload = createPostureUploadUrl({
        assetId: "asset-test",
        mimeType: "image/png",
      });
      const url = new URL(upload.uploadUrl);
      expect(upload.storageKey).toBe("posture/asset-test.png");
      expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
      expect(Number(url.searchParams.get("X-Amz-Expires"))).toBe(600);
      expect(upload.requiredHeaders["x-amz-server-side-encryption"]).toBe(
        "AES256",
      );
      expect(upload.uploadUrl).not.toContain("test-secret");
    } finally {
      for (const key of keys) {
        const value = previous[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("fails closed when production storage and security settings are missing", () => {
    const keys = [
      "BOKS_RUNTIME_ENV",
      "NODE_ENV",
      "BOKS_DATABASE_URL",
      "BOKS_STORAGE_MODE",
      "BOKS_ADMIN_TOKEN",
      "BOKS_OBJECT_STORAGE_BUCKET",
      "BOKS_CORS_ORIGIN",
      "BOKS_ENABLE_DEV_AUTH",
    ] as const;
    const previous = Object.fromEntries(
      keys.map((key) => [key, process.env[key]]),
    );
    try {
      process.env.BOKS_RUNTIME_ENV = "production";
      delete process.env.BOKS_DATABASE_URL;
      delete process.env.BOKS_STORAGE_MODE;
      delete process.env.BOKS_ADMIN_TOKEN;
      delete process.env.BOKS_OBJECT_STORAGE_BUCKET;
      delete process.env.BOKS_CORS_ORIGIN;
      delete process.env.BOKS_ENABLE_DEV_AUTH;
      expect(() => assertRuntimeConfig()).toThrow("运行配置校验失败");
    } finally {
      for (const key of keys) {
        const value = previous[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("requires an allowed reviewer and valid TOTP for production admin access", () => {
    const keys = [
      "BOKS_RUNTIME_ENV",
      "BOKS_ADMIN_TOKEN",
      "BOKS_ADMIN_REVIEWERS",
      "BOKS_ADMIN_MFA_SECRET",
      "BOKS_ENABLE_DEV_AUTH",
    ] as const;
    const previous = Object.fromEntries(
      keys.map((key) => [key, process.env[key]]),
    );
    vi.setSystemTime(new Date("1970-01-01T00:00:59.000Z"));
    try {
      process.env.BOKS_RUNTIME_ENV = "production";
      process.env.BOKS_ADMIN_TOKEN = "production-admin-token";
      process.env.BOKS_ADMIN_REVIEWERS = "reviewer-one,reviewer-two";
      process.env.BOKS_ADMIN_MFA_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
      process.env.BOKS_ENABLE_DEV_AUTH = "false";
      const request = (reviewer: string, mfa: string) =>
        ({
          headers: {
            "x-admin-token": "production-admin-token",
            "x-admin-reviewer": reviewer,
            "x-admin-mfa": mfa,
          },
        }) as unknown as import("express").Request;

      expect(auth.adminReviewer(request("reviewer-one", "287082"))).toBe(
        "reviewer-one",
      );
      expect(() =>
        auth.adminReviewer(request("outside-reviewer", "287082")),
      ).toThrow();
      expect(() =>
        auth.adminReviewer(request("reviewer-one", "000000")),
      ).toThrow();
    } finally {
      vi.useRealTimers();
      for (const key of keys) {
        const value = previous[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
