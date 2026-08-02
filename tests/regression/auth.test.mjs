/**
 * 回归测试 — 关键接口 + 已知边界
 */
import { strict as assert } from "node:assert";

const API = process.env.API_BASE ?? "http://127.0.0.1:3000/v1";
let pass = 0, fail = 0;

async function req(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "X-Client-Version": "0.2.0-regression", ...opts.headers },
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

async function expect(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`✅ ${name}`);
  } catch (e) {
    fail++;
    console.log(`❌ ${name}\n   ${e.message}`);
  }
}

await expect("登录：guardian-demo-001", async () => {
  const { body } = await req("/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({ guardian_id: "guardian-demo-001" }),
  });
  assert.ok(body.data?.token);
});

await expect("登录：guardian-demo-002", async () => {
  const { body } = await req("/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({ guardian_id: "guardian-demo-002" }),
  });
  assert.ok(body.data?.token);
});

await expect("登录：guardian 不存在（dev login 自动注册）", async () => {
  const { status, body } = await req("/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({ guardian_id: "guardian-not-exists-xyz" }),
  });
  assert.ok([200, 201].includes(status), `实际 ${status}`);
  assert.ok(body.data?.token, "dev login 必须返回 token");
});

await expect("refresh：合法 refresh_token", async () => {
  const login = await req("/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({ guardian_id: "guardian-demo-001" }),
  });
  const { body } = await req("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: login.body.data.refresh_token }),
  });
  assert.ok(body.data?.token);
});

await expect("refresh：非法 refresh_token", async () => {
  const { status, body } = await req("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: "fake-token" }),
  });
  assert.ok([400, 401].includes(status), `实际 ${status}`);
});

console.log(`\n回归：${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);