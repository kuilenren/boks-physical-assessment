/**
 * KMS 适配层（生产路径：Vault/HSM；本地路径：环境变量 KEK + 本地 envelope）
 * 设计原则：
 * - 主密钥 KEK 永不落库；环境变量 BOKS_KEK_BASE64 或 KMS provider 注入
 * - 每个 family 一个 DEK（数据加密密钥），被 KEK 加密后存于 boks.boks_kms_keys
 * - DEK 通过 runtime cache 持有，应用启动时 unwrap 一次
 * - 密钥轮换：写入新 KEK 后批量 reencrypt（见 scripts/reencrypt.ts）
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, createHmac } from "node:crypto";
import { Pool } from "pg";

export type WrappedKey = {
  kekId: string;
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

function b64(buf: Buffer): string {
  return buf.toString("base64");
}
function unb64(s: string): Buffer {
  return Buffer.from(s, "base64");
}

function loadKek(): { kekId: string; key: Buffer } {
  const id = process.env.BOKS_KEK_ID ?? "kek-local-v1";
  const b64kek = process.env.BOKS_KEK_BASE64;
  if (!b64kek) {
    throw new Error(
      "BOKS_KEK_BASE64 未设置；本地 KMS 必须配置 32 字节主密钥（base64）。生产应接入 Vault/KMS。",
    );
  }
  const key = unb64(b64kek);
  if (key.length !== 32) {
    throw new Error(`BOKS_KEK_BASE64 长度必须为 32 字节（base64 = 44 字符），当前 ${key.length}`);
  }
  return { kekId: id, key };
}

export function generateDek(): Buffer {
  return randomBytes(32);
}

export function wrapDek(dek: Buffer, kek: Buffer, kekId: string): WrappedKey {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", kek, iv);
  const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { kekId, ciphertext, iv, authTag };
}

export function unwrapDek(wrapped: WrappedKey, kek: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", kek, wrapped.iv);
  decipher.setAuthTag(wrapped.authTag);
  return Buffer.concat([decipher.update(wrapped.ciphertext), decipher.final()]);
}

export function envelopeEncrypt(plaintext: Buffer, dek: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dek, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export function envelopeDecrypt(ciphertext: Buffer, dek: Buffer): Buffer {
  const iv = ciphertext.subarray(0, 12);
  const tag = ciphertext.subarray(12, 28);
  const ct = ciphertext.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", dek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

const dekCache = new Map<string, Buffer>(); // family_id -> DEK

export async function getFamilyDek(
  familyId: string,
  pool: Pool,
): Promise<Buffer> {
  const cached = dekCache.get(familyId);
  if (cached) return cached;
  const { kekId, key: kek } = loadKek();
  const { rows } = await pool.query<{
    wrapped_dek: Buffer;
    iv: Buffer;
    auth_tag: Buffer;
    kek_id: string;
  }>(
    `SELECT wrapped_dek, iv, auth_tag, kek_id
     FROM boks.boks_kms_keys
     WHERE family_id = $1 AND status = 'active'
     LIMIT 1`,
    [familyId],
  );
  if (rows.length === 0) {
    // 自动创建：生产应通过管理后台显式创建，本地 dev 自动 bootstrap
    if (process.env.BOKS_RUNTIME_ENV === "production") {
      throw new Error(`Family ${familyId} 未配置 DEK；生产环境禁止自动创建。`);
    }
    const dek = generateDek();
    const wrapped = wrapDek(dek, kek, kekId);
    await pool.query(
      `INSERT INTO boks.boks_kms_keys (family_id, kek_id, wrapped_dek, iv, auth_tag)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (family_id) DO NOTHING`,
      [familyId, kekId, wrapped.ciphertext, wrapped.iv, wrapped.authTag],
    );
    dekCache.set(familyId, dek);
    return dek;
  }
  const wrapped: WrappedKey = {
    kekId: rows[0].kek_id,
    ciphertext: rows[0].wrapped_dek,
    iv: rows[0].iv,
    authTag: rows[0].auth_tag,
  };
  const dek = unwrapDek(wrapped, kek);
  dekCache.set(familyId, dek);
  return dek;
}

export function invalidateFamilyDek(familyId: string): void {
  dekCache.delete(familyId);
}

/** HMAC-SHA256 单向哈希（用于 token、subject_hash 等不可逆字段） */
export function hmacSha256(value: string): string {
  const key = process.env.BOKS_HMAC_KEY ?? loadKek().key.toString("hex");
  return createHmac("sha256", key).update(value).digest("hex");
}

/** 用于幂等键的稳定 hash（key + route） */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const _internal = { b64, unb64 };