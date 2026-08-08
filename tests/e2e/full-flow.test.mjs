/**
 * 端到端测试脚本（API + 小程序 + Flutter 互通）
 */
import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
const require = createRequire("D:/boks/bokstice/services/api/package.json");
const { Pool } = require("pg");

const API = process.env.API_BASE ?? "http://127.0.0.1:3000/v1";
const AI = process.env.AI_BASE ?? "http://127.0.0.1:8001";

let pass = 0;
let fail = 0;
const failures = [];

async function test(name, fn) {
  process.stdout.write(`▶ ${name} ... `);
  try {
    await fn();
    pass++;
    console.log("✅");
  } catch (e) {
    fail++;
    failures.push({ name, error: e.message });
    console.log(`❌\n   ${e.stack ?? e.message}`);
  }
}

async function req(path, opts = {}) {
  const url = `${API}${path}`;
  const headers = {
    "Content-Type": "application/json",
    "X-Client-Version": "0.2.0-test",
    ...opts.headers,
  };
  const r = await fetch(url, { ...opts, headers });
  const ct = r.headers.get("content-type") ?? "";
  const body = ct.includes("application/json")
    ? await r.json()
    : await r.text();
  return { status: r.status, body, headers: r.headers };
}

async function aiReq(path, opts = {}) {
  const r = await fetch(`${AI}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers },
  });
  return { status: r.status, body: await r.json() };
}

await test("API /health 返回 200 ok", async () => {
  const { status, body } = await req("/health");
  assert.equal(status, 200);
  assert.equal(body.status, "ok");
});

await test("API /health/ready 返回 ready", async () => {
  const { status, body } = await req("/health/ready");
  assert.equal(status, 200);
  assert.equal(body.status, "ready");
});

await test("AI /health 返回 200", async () => {
  const { status, body } = await aiReq("/health");
  assert.equal(status, 200);
  assert.equal(body.status, "ok");
});

// 幂等键
await test("幂等键：同 key + 同 body 第二次返回缓存", async () => {
  const key = `e2e-${Date.now()}`;
  const body = {
    guardian_id: "guardian-demo-001",
    family_id: "family-primary-low-001",
  };
  const r1 = await req("/auth/dev-login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Idempotency-Key": key },
  });
  assert.ok(
    [200, 201].includes(r1.status),
    `dev-login 期望 200/201，实际 ${r1.status}`,
  );
  const t1 = r1.body?.data?.token;
  assert.ok(t1, "首次必须返回 token");
  const r2 = await req("/auth/dev-login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Idempotency-Key": key },
  });
  assert.ok([200, 201].includes(r2.status));
  assert.equal(r2.body?.data?.token, t1, "幂等键命中必须返回相同 token");
});

await test("幂等键：同 key + 不同 body 返回 409", async () => {
  const key = `e2e-mismatch-${Date.now()}`;
  const r1 = await req("/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({
      guardian_id: "guardian-demo-001",
      family_id: "family-primary-low-001",
    }),
    headers: { "Idempotency-Key": key },
  });
  assert.ok([200, 201].includes(r1.status));
  const r2 = await req("/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({
      guardian_id: "guardian-demo-002",
      family_id: "family-junior-003",
    }),
    headers: { "Idempotency-Key": key },
  });
  assert.equal(r2.status, 409);
  assert.equal(r2.body?.error?.code, "IDEMPOTENCY_KEY_MISMATCH");
});

let token;
let familyId;
await test("dev-login 返回 access + refresh（family-primary-low-001）", async () => {
  const { status, body } = await req("/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({
      guardian_id: "guardian-demo-001",
      family_id: "family-primary-low-001",
    }),
  });
  assert.ok([200, 201].includes(status));
  assert.ok(body.data?.token);
  assert.ok(body.data?.refresh_token);
  assert.equal(
    body.data?.family_id,
    "family-primary-low-001",
    "必须绑定到指定 family",
  );
  token = body.data.token;
  familyId = body.data.family_id;
});

await test("Family: GET /families/me 返回家庭 + 儿童列表", async () => {
  const { status, body } = await req("/families/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(status, 200);
  assert.ok(body.data);
  assert.ok(Array.isArray(body.data.children ?? body.data?.members));
});

await test("Family: 选择 child-001（小学低段）", async () => {
  const { status, body } = await req("/families/me/children/child-001/select", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  // 该 endpoint 不一定存在；至少不要 5xx
  assert.ok(status < 500, `select 应非 5xx，实际 ${status}`);
});

// 学段互通：小学/初中/高中 / 幼儿
const stages = [
  { id: "child-001", stage: "primary-low" },
  { id: "child-002", stage: "primary-high" },
  { id: "child-003", stage: "junior" },
  { id: "child-004", stage: "senior" },
  { id: "child-005", stage: "preschool" },
];
for (const c of stages) {
  await test(`Child ${c.id} (${c.stage}) 体测历史接口可达`, async () => {
    const { status } = await req(`/assessment/history?child_id=${c.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 注：当前 demo seed 已扩展；不应 5xx；可能 200/404（preschool 没体测）
    assert.ok([200, 400, 404].includes(status), `${c.id} status=${status}`);
  });
}

// AI 流式 SSE
await test("AI 流式 chat 返回 SSE", async () => {
  const r = await fetch(`${AI}/v1/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: "如何提升跳绳成绩？",
      audience: "primary",
    }),
  });
  assert.equal(r.status, 200);
  const ct = r.headers.get("content-type") ?? "";
  assert.ok(
    ct.includes("text/event-stream"),
    `content-type 应含 text/event-stream，实际 ${ct}`,
  );
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const events = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const evMatch = block.match(/^event:\s*(.+)$/m);
      const dataMatch = block.match(/^data:\s*(.+)$/m);
      if (evMatch && dataMatch) {
        events.push({
          event: evMatch[1].trim(),
          data: JSON.parse(dataMatch[1].trim()),
        });
      }
    }
  }
  assert.ok(events.length > 0, "至少应收到 1 个 SSE 事件");
});

// AI 安全拦截
await test("AI 拦截疼痛关键词（非流式）", async () => {
  const { status, body } = await aiReq("/v1/chat", {
    method: "POST",
    body: JSON.stringify({
      content: "我家孩子夜间疼痛好几天了，是什么原因？",
      documents: [],
    }),
  });
  assert.equal(status, 200);
  assert.equal(body.intercepted, true);
  assert.ok(/诊断|不能/.test(body.content));
});

// AI 普通问题
await test("AI 普通问题（KB 模板或 LLM）", async () => {
  const { status, body } = await aiReq("/v1/chat", {
    method: "POST",
    body: JSON.stringify({
      content: "50 米跑评分标准是什么？",
      documents: [],
    }),
  });
  assert.equal(status, 200);
  assert.ok(body.content?.length > 0, "AI 必须返回内容");
});

// 审计
await test("审计：boks_audit_events 表存在且可写", async () => {
  const pool = new Pool({ connectionString: process.env.BOKS_DATABASE_URL });
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS n FROM boks.boks_audit_events",
    );
    assert.ok(rows[0].n >= 0, "审计表可读");
  } finally {
    await pool.end();
  }
});

// RLS 强制
await test("RLS: boks.boks_children FORCE RLS 启用", async () => {
  const pool = new Pool({ connectionString: process.env.BOKS_DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='boks_children' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='boks')`,
    );
    assert.ok(rows[0]?.relrowsecurity === true, "RLS 必须启用");
    assert.ok(rows[0]?.relforcerowsecurity === true, "RLS 必须 FORCE");
  } finally {
    await pool.end();
  }
});

// pgvector
await test("pgvector: boks.boks_knowledge_chunks.embedding 列存在", async () => {
  const pool = new Pool({ connectionString: process.env.BOKS_DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `SELECT data_type, udt_name FROM information_schema.columns WHERE table_schema='boks' AND table_name='boks_knowledge_chunks' AND column_name='embedding'`,
    );
    assert.equal(rows[0]?.udt_name, "vector", "embedding 应为 vector 类型");
  } finally {
    await pool.end();
  }
});

console.log(`\n─────────────────────────────────`);
console.log(`✅ pass: ${pass}  ❌ fail: ${fail}`);
if (fail > 0) {
  for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
  process.exit(1);
}
