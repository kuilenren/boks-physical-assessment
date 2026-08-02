/**
 * AB 测试 — 基于 X-Client-Version 的版本灰度
 * 用法：BOKS_AB_BUCKETS='{"0.2.0-a":50,"0.2.0-b":50}' node tests/ab/run.mjs
 * 流量分桶：根据 family_id 哈希 mod 100 落到 0-99
 */
import { createHash } from "node:crypto";

const API = process.env.API_BASE ?? "http://127.0.0.1:3000/v1";
const BUCKETS = JSON.parse(process.env.BOKS_AB_BUCKETS ?? '{"0.2.0-a":50,"0.2.0-b":50}');

function bucket(familyId) {
  const h = createHash("sha256").update(familyId).digest();
  const n = h.readUInt16BE(0) % 100;
  let cum = 0;
  for (const [version, weight] of Object.entries(BUCKETS)) {
    cum += weight;
    if (n < cum) return version;
  }
  return Object.keys(BUCKETS)[0];
}

export function selectVersion(familyId) {
  return bucket(familyId);
}

export async function abRequest(familyId, path, opts = {}) {
  const version = selectVersion(familyId);
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "X-Client-Version": version,
      "X-Family-Hint": familyId,
      ...opts.headers,
    },
  });
  return { version, status: r.status, body: await r.json() };
}

if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  const families = ["family-primary-low-001", "family-junior-003", "family-senior-004", "family-preschool-005", "family-multi-006"];
  const counts = {};
  for (const f of families) {
    const v = selectVersion(f);
    counts[v] = (counts[v] ?? 0) + 1;
    console.log(`${f} → ${v}`);
  }
  console.log(`\n分桶结果：${JSON.stringify(counts)}`);

  console.log("\n--- AB 端到端分桶请求验证 ---");
  for (const f of families) {
    try {
      const r = await abRequest(f, "/health");
      console.log(`${f} (${r.version}) status=${r.status}`);
    } catch (e) {
      console.log(`${f} (${selectVersion(f)}) error=${e.message}`);
    }
  }
}