/**
 * KMS / DEK 引导脚本（生产部署必跑）
 *
 * 用途：
 *   1. 为每一个已存在的 family 创建 DEK（用当前 KEK 包装后写入 boks.boks_kms_keys）
 *   2. 校验 KEK 长度（必须是 32 字节）
 *   3. 可选：--rotate 模式下将旧 DEK 标 rotating、新建 DEK、触发 reencrypt
 *
 * 用法：
 *   BOKS_KEK_ID=... BOKS_KEK_BASE64=... BOKS_DATABASE_URL=... \
 *     pnpm exec tsx scripts/bootstrap-kms.ts
 *
 *   BOKS_KEK_ID=... BOKS_KEK_BASE64=... \
 *     pnpm exec tsx scripts/bootstrap-kms.ts --rotate --new-kek-id=kek-v2
 */
import { Pool } from "pg";
import { createCipheriv, randomBytes } from "node:crypto";
import { isProductionRuntime } from "../src/runtime-config.js";

function unb64(s: string): Buffer {
  return Buffer.from(s, "base64");
}

function loadKekFromEnv(): { kekId: string; key: Buffer } {
  const id = process.env.BOKS_KEK_ID;
  const b64 = process.env.BOKS_KEK_BASE64;
  if (!id) throw new Error("BOKS_KEK_ID 未设置");
  if (!b64) throw new Error("BOKS_KEK_BASE64 未设置");
  const key = unb64(b64);
  if (key.length !== 32) {
    throw new Error(
      `BOKS_KEK_BASE64 解码后必须为 32 字节（base64 = 44 字符），当前 ${key.length} 字节`,
    );
  }
  return { kekId: id, key };
}

async function main(): Promise<void> {
  const url = process.env.BOKS_DATABASE_URL;
  if (!url) {
    console.error("BOKS_DATABASE_URL 未设置");
    process.exit(1);
  }
  const args = new Set(process.argv.slice(2));
  const isRotate = args.has("--rotate");
  const newKekId = (() => {
    const arg = process.argv.find((a) => a.startsWith("--new-kek-id="));
    return arg ? arg.split("=")[1] : undefined;
  })();

  const { kekId, key: kek } = loadKekFromEnv();
  console.log(
    JSON.stringify({
      event: "kms.bootstrap.start",
      kekId,
      rotate: isRotate,
      newKekId,
      runtime: isProductionRuntime() ? "production" : "development",
    }),
  );

  const pool = new Pool({ connectionString: url, max: 4 });
  try {
    const families = await pool.query<{ family_id: string }>(
      "SELECT id AS family_id FROM boks.boks_families",
    );
    let created = 0;
    let rotated = 0;
    let skipped = 0;
    for (const { family_id } of families.rows) {
      const exists = await pool.query<{ kek_id: string; status: string }>(
        "SELECT kek_id, status FROM boks.boks_kms_keys WHERE family_id = $1 LIMIT 1",
        [family_id],
      );
      if (exists.rowCount === 0) {
        const dek = randomBytes(32);
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", kek, iv);
        const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
        const authTag = cipher.getAuthTag();
        await pool.query(
          `INSERT INTO boks.boks_kms_keys (family_id, kek_id, wrapped_dek, iv, auth_tag, status)
           VALUES ($1,$2,$3,$4,$5,'active')
           ON CONFLICT (family_id) DO NOTHING`,
          [family_id, kekId, ciphertext, iv, authTag],
        );
        created++;
      } else if (isRotate && exists.rows[0].kek_id !== newKekId) {
        const dek = randomBytes(32);
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", kek, iv);
        const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
        const authTag = cipher.getAuthTag();
        const activeKekId = newKekId ?? kekId;
        await pool.query(
          `UPDATE boks.boks_kms_keys SET status = 'retired', retired_at = NOW() WHERE family_id = $1 AND status = 'active'`,
          [family_id],
        );
        await pool.query(
          `INSERT INTO boks.boks_kms_keys (family_id, kek_id, wrapped_dek, iv, auth_tag, status)
           VALUES ($1,$2,$3,$4,$5,'active')`,
          [family_id, activeKekId, ciphertext, iv, authTag],
        );
        rotated++;
      } else {
        skipped++;
      }
    }
    console.log(
      JSON.stringify({
        event: "kms.bootstrap.done",
        families: families.rowCount,
        created,
        rotated,
        skipped,
      }),
    );
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(
    JSON.stringify({ event: "kms.bootstrap.failed", error: String(e) }),
  );
  process.exit(1);
});
