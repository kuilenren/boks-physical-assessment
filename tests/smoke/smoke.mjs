/**
 * 冒烟测试 — 启动后 30 秒内必过的关键路径
 * 用于 CI 部署后立即验证
 */
import { strict as assert } from "node:assert";

const API = process.env.API_BASE ?? "http://127.0.0.1:3000/v1";
const AI = process.env.AI_BASE ?? "http://127.0.0.1:8001";

const smoke = [
  {
    name: "API health",
    url: `${API}/health`,
    expect: (b) => b.status === "ok",
  },
  {
    name: "API ready",
    url: `${API}/health/ready`,
    expect: (b) => b.status === "ready",
  },
  { name: "AI health", url: `${AI}/health`, expect: (b) => b.status === "ok" },
];

let pass = 0,
  fail = 0;
for (const t of smoke) {
  try {
    const r = await fetch(t.url);
    const body = await r.json();
    assert.ok(t.expect(body), `${t.name} 校验失败：${JSON.stringify(body)}`);
    console.log(`✅ ${t.name}`);
    pass++;
  } catch (e) {
    console.log(`❌ ${t.name}: ${e.message}`);
    fail++;
  }
}

console.log(`\n冒烟：${pass}/${smoke.length}`);
process.exitCode = fail === 0 ? 0 : 1;
