# BOKS 数据库迁移 / RLS / 加密 落地深化（增量深化 #4）

> **配套文档**：`docs/16` §3 + §4、`docs/17` §阶段 2、`docs/08-database-design.md`、`docs/11-security-privacy-compliance.md`
> **审查基线**：2026-08-02（Asia/Shanghai）
> **范围**：`services/api/migrations/001_boks_store_documents.sql`、`services/api/src/{storage,demo-store,auth}.ts`
> **目标**：把"1 个 migration 文件 + JSON 双写 + 无 RLS + 无字段加密 + 无迁移版本表"升级为"分领域 migration + pgvector/RLS/字段加密 + 全量审计 + 备份恢复演练"

---

## 目录

- [0. 当前现状与差距](#0-当前现状与差距)
- [1. 数据库演进策略](#1-数据库演进策略)
- [2. 迁移版本与工具链](#2-迁移版本与工具链)
- [3. RLS 策略（按表落地）](#3-rls-策略按表落地)
- [4. 字段级加密（pgcrypto + 信封加密）](#4-字段级加密pgcrypto--信封加密)
- [5. 备份恢复 / PITR](#5-备份恢复--pitr)
- [6. 索引与查询优化](#6-索引与查询优化)
- [7. 审计与可追溯](#7-审计与可追溯)
- [8. 与 NestJS 仓储层集成](#8-与-nestjs-仓储层集成)
- [9. 测试与演练](#9-测试与演练)
- [10. 落地执行（接续 17 阶段 2）](#10-落地执行接续-17-阶段-2)
- [附录 A：完整 migration 清单](#附录-a完整-migration-清单)

---

## 0. 当前现状与差距

### 0.1 迁移现状

**唯一文件**：`services/api/migrations/001_boks_store_documents.sql`（274 行）

| 问题 | 证据 |
|---|---|
| 仅 1 个 migration | `ls migrations/` = 1 个文件 |
| 无 `schema_migrations` 表 | `grep -r schema_migrations` 0 命中 |
| 无 down 迁移 | 文件中无 `-- DOWN` 段 |
| 无版本顺序保护 | 文件名以数字开头但无执行顺序记录 |
| 命名混乱 | `001_boks_store_documents.sql` 同时含 store_documents、families、guardians、children、consents、assessments、posture、training、knowledge、chat、audit、standards 等**12 个领域** |
| 用 ALTER 但无 IF NOT EXISTS guard | `:188-193` 有 `ADD COLUMN IF NOT EXISTS`（迁移历史修改痕迹未拆分文件） |

### 0.2 数据访问现状

`services/api/src/storage.ts:413-1184` 是 `syncRelationalTables()`：JSON 双写 + 关系表
`services/api/src/demo-store.ts:37901 bytes` 是 JSON 仓储 + 行锁更新

| 问题 | 证据 |
|---|---|
| 开发默认 JSON 文件 | `runtime-config.ts` 中 `BOKS_DATA_FILE` |
| 关系表 12 领域同步 | `storage.ts:413-1184` |
| 无 RLS | 整仓 0 命中 |
| 无字段加密 | 整仓 0 命中（`pgcrypto`、`ENCRYPTED` 等） |
| 无 Idempotency-Key | `grep -r "Idempotency-Key"` 在中间件 = 0 |
| 无备份恢复演练 | 文档中未提及 |
| 无 PgBouncer/连接池配置 | — |

### 0.3 安全现状

| 项 | 状态 |
|---|---|
| 数据库用户最小权限 | 推测 root（无 GRANT 清单） |
| 传输加密 | 推测 SSL 未强制 |
| 静态加密（pgcrypto） | 无 |
| 列加密 | 无 |
| 密钥管理（KMS / Vault） | 无 |
| 审计日志独立表 | `boks_audit_events` 存在但字段过少 |
| DPA / DPIA | 未落地 |
| 未成年人同意版本化 | 有但仅 4 个 purpose（`privacy/assessment/photo/voice`） |

---

## 1. 数据库演进策略

### 1.1 总体策略

```
领域化 migration（每个领域一个目录）
    + 顺序执行（schema_migrations 表）
    + 前向迁移（UP）+ 回滚（DOWN）
    + 演练（dry-run on staging）
    + 与代码同包管理（代码 + migration 同 PR）
    + 强制 lint（migration SQL 必须含注释 + 索引 + 约束）
```

### 1.2 目录结构

```
services/api/
├── migrations/
│   ├── 0001_core/                       # PG 扩展、schema_migrations
│   │   ├── 0001_extensions.sql
│   │   ├── 0002_schema_migrations.sql
│   │   └── 0003_app_user.sql
│   ├── 0010_identity/                   # 家庭/监护人/会话
│   │   ├── 0010_families.sql
│   │   ├── 0011_guardians.sql
│   │   ├── 0012_memberships.sql
│   │   ├── 0013_identity_bindings.sql
│   │   └── 0014_guardian_sessions.sql
│   ├── 0020_consent/                    # 同意记录
│   │   └── 0020_consents.sql
│   ├── 0030_children/                   # 儿童档案
│   │   └── 0030_children.sql
│   ├── 0040_assessment/                 # 体测
│   │   ├── 0040_sessions.sql
│   │   ├── 0041_reports.sql
│   │   └── 0042_rls.sql
│   ├── 0050_posture/                    # 体态
│   │   ├── 0050_sessions.sql
│   │   ├── 0051_assets.sql
│   │   ├── 0052_reports.sql
│   │   └── 0053_rls.sql
│   ├── 0060_training/                   # 训练
│   │   ├── 0060_plans.sql
│   │   ├── 0061_check_ins.sql
│   │   └── 0062_rls.sql
│   ├── 0070_chat/                       # 对话
│   │   ├── 0070_conversations.sql
│   │   ├── 0071_messages.sql
│   │   └── 0072_rls.sql
│   ├── 0080_knowledge/                  # 知识库 + 向量
│   │   ├── 0080_sources.sql
│   │   ├── 0081_versions.sql
│   │   ├── 0082_chunks.sql
│   │   ├── 0083_embeddings.sql
│   │   └── 0084_rls.sql
│   ├── 0090_standards/                  # 标准规则
│   │   ├── 0090_versions.sql
│   │   ├── 0091_indicators.sql
│   │   ├── 0092_score_bands.sql
│   │   └── 0093_rules.sql
│   ├── 0100_platform/                   # 平台文档（knowledge config 等）
│   │   └── 0100_platform_documents.sql
│   ├── 0110_audit/                      # 审计
│   │   ├── 0110_audit_events.sql
│   │   └── 0111_deletion_requests.sql
│   ├── 0120_security/                   # 加密 + 安全
│   │   ├── 0120_pgcrypto_setup.sql
│   │   ├── 0121_kms_key_registry.sql
│   │   └── 0122_field_encryption.sql
│   ├── 0130_ai/                         # AI（prompt、usage、trace）
│   │   ├── 0130_prompt_versions.sql
│   │   ├── 0131_llm_usage.sql
│   │   ├── 0132_agent_traces.sql
│   │   └── 0133_cost_daily.sql
│   ├── 0140_idempotency/                # 幂等键
│   │   └── 0140_idempotency_keys.sql
│   └── README.md
├── scripts/
│   ├── migrate.ts                       # 迁移执行器
│   ├── verify-migration.ts              # 校验（核对 hash、顺序）
│   ├── seed-dev.ts                      # 开发种子
│   ├── backup.sh                        # 备份
│   ├── restore.sh                       # 恢复（含 PITR）
│   └── reencrypt.ts                     # 密钥轮换
```

### 1.3 迁移顺序总览

```
0001 扩展（pgcrypto、uuid-ossp、pgvector、citext）
0002 schema_migrations（迁移版本表）
0003 应用账户（app_user/app_owner/app_readonly）
0010-0090 业务领域（按依赖顺序）
0100-0120 平台与安全
0130-0140 AI 与幂等
```

---

## 2. 迁移版本与工具链

### 2.1 `boks_schema_migrations` 表

```sql
-- migrations/0001_core/0002_schema_migrations.sql
CREATE TABLE IF NOT EXISTS boks_schema_migrations (
  id              TEXT PRIMARY KEY,          -- "0010_identity/0010_families.sql"
  version         INTEGER NOT NULL,          -- 顺序号
  domain          TEXT NOT NULL,             -- "identity"
  checksum_sha256 TEXT NOT NULL,             -- 文件哈希（任何修改禁止 silent 漂移）
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by      TEXT NOT NULL,             -- 迁移执行账户
  duration_ms     INTEGER NOT NULL,
  rollback_sql    TEXT,                      -- DOWN 内容（如有）
  UNIQUE (domain, version)
);

CREATE INDEX IF NOT EXISTS boks_schema_migrations_applied_idx
  ON boks_schema_migrations (applied_at DESC);
```

### 2.2 迁移执行器（`scripts/migrate.ts`）

```typescript
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Pool } from "pg";

const MIGRATIONS_DIR = "migrations";

async function discover(): Promise<MigrationFile[]> {
  const out: MigrationFile[] = [];
  for (const domain of await readdir(MIGRATIONS_DIR)) {
    const dir = `${MIGRATIONS_DIR}/${domain}`;
    for (const file of await readdir(dir)) {
      if (!file.endsWith(".sql")) continue;
      const body = await readFile(`${dir}/${file}`, "utf8");
      const checksum = createHash("sha256").update(body).digest("hex");
      const m = file.match(/^(\d{4})_(.+)\.sql$/);
      if (!m) throw new Error(`Bad filename: ${file}`);
      out.push({ id: `${domain}/${file}`, version: parseInt(m[1]), domain, name: m[2], body, checksum });
    }
  }
  return out.sort((a, b) => a.version - b.version);
}

async function ensureTable(client: PoolClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS boks_schema_migrations (
    id TEXT PRIMARY KEY, version INTEGER NOT NULL, domain TEXT NOT NULL,
    checksum_sha256 TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by TEXT NOT NULL, duration_ms INTEGER NOT NULL, rollback_sql TEXT
  )`);
}

export async function migrate({ url, user, dryRun = false }: { url: string; user: string; dryRun?: boolean }) {
  const pool = new Pool({ connectionString: url, user });
  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    await ensureTable(client);
    const applied = new Map(
      (await client.query("SELECT id, checksum_sha256 FROM boks_schema_migrations")).rows.map((r) => [r.id, r.checksum_sha256])
    );
    for (const m of await discover()) {
      const prev = applied.get(m.id);
      if (prev) {
        if (prev !== m.checksum) throw new Error(`Migration ${m.id} 已应用但 checksum 不一致，禁止漂移。`);
        console.log(`SKIP  ${m.id}`);
        continue;
      }
      console.log(`${dryRun ? "DRY " : ""}APPLY ${m.id}`);
      if (dryRun) continue;
      const t0 = Date.now();
      await client.query(m.body);
      const [up, down] = splitUpDown(m.body);
      await client.query(
        `INSERT INTO boks_schema_migrations(id, version, domain, checksum_sha256, applied_by, duration_ms, rollback_sql)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [m.id, m.version, m.domain, m.checksum, user, Date.now() - t0, down]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

function splitUpDown(body: string): [string, string] {
  const i = body.indexOf("-- DOWN");
  return i === -1 ? [body, ""] : [body.slice(0, i).trim(), body.slice(i + "-- DOWN".length).trim()];
}
```

### 2.3 迁移文件示例（含 UP/DOWN）

```sql
-- migrations/0010_identity/0010_families.sql
-- UP
CREATE TABLE IF NOT EXISTS boks_families (
  id              TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','archived','deleted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_families_status_idx ON boks_families (status);

-- DOWN
DROP TABLE IF EXISTS boks_families;
```

### 2.4 强制规则（lint）

```bash
# scripts/lint-migrations.sh
for f in $(find migrations -name "*.sql"); do
  # 必须含 -- UP 和 -- DOWN
  grep -q "^-- UP$" "$f" || (echo "Missing -- UP in $f"; exit 1)
  grep -q "^-- DOWN$" "$f" || (echo "Missing -- DOWN in $f"; exit 1)
  # 必须 CREATE INDEX（如有 CREATE TABLE）
  if grep -q "CREATE TABLE" "$f"; then
    grep -q "CREATE INDEX" "$f" || (echo "Missing index in $f"; exit 1)
  fi
done
```

---

## 3. RLS 策略（按表落地）

### 3.1 总体模型

**所有表必须满足**：
1. 有 `family_id`（即使是平台表 `boks_*_platform_documents` 也按 `id` 做 ACL）。
2. 启用 RLS：`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`。
3. 强制 RLS：`ALTER TABLE ... FORCE ROW LEVEL SECURITY`（防止 owner 绕过）。
4. 应用账户 `boks_app` 使用 `SET LOCAL` 设置 `app.family_id`。

### 3.2 应用账户分层

```sql
-- migrations/0001_core/0003_app_user.sql
-- UP
CREATE ROLE boks_app       NOLOGIN;       -- 应用主账户（DML）
CREATE ROLE boks_owner     NOLOGIN;       -- owner（仅迁移使用）
CREATE ROLE boks_readonly  NOLOGIN;       -- 报表/审计只读

-- 应用账户授权（最小权限）
GRANT USAGE ON SCHEMA public TO boks_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO boks_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO boks_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO boks_app;

-- 迁移时使用 owner（开发期）
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO boks_owner;

-- 只读
GRANT SELECT ON ALL TABLES IN SCHEMA public TO boks_readonly;

-- DOWN
DROP ROLE IF EXISTS boks_readonly;
DROP ROLE IF EXISTS boks_owner;
DROP ROLE IF EXISTS boks_app;
```

### 3.3 通用 RLS 模式（以 `boks_children` 为例）

```sql
-- migrations/0030_children/0030_children.sql
CREATE TABLE IF NOT EXISTS boks_children (
  id              TEXT PRIMARY KEY,
  family_id       TEXT NOT NULL REFERENCES boks_families(id),
  display_name    TEXT NOT NULL,
  birth_date      DATE NOT NULL,
  sex_code        TEXT NOT NULL CHECK (sex_code IN ('female','male','unspecified')),
  school_stage    TEXT NOT NULL CHECK (school_stage IN ('preschool','primary','junior_high','senior_high')),
  grade_code      TEXT NOT NULL,
  profile_status  TEXT NOT NULL DEFAULT 'active'
                  CHECK (profile_status IN ('active','archived','deleted')),
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS boks_children_family_idx ON boks_children (family_id, profile_status);
CREATE INDEX IF NOT EXISTS boks_children_birth_idx ON boks_children (birth_date);

-- 强制 RLS
ALTER TABLE boks_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks_children FORCE ROW LEVEL SECURITY;

-- 策略：app_user 仅能访问当前 family
CREATE POLICY boks_children_family_isolation ON boks_children
  USING (family_id = current_setting('app.family_id', true))
  WITH CHECK (family_id = current_setting('app.family_id', true));

-- 仅 owner 可跨 family（如审核场景，单独账户）
CREATE POLICY boks_children_owner_all ON boks_children
  TO boks_owner
  USING (true) WITH CHECK (true);
```

### 3.4 应用层设置 context

```typescript
// services/api/src/db.ts
export async function withFamilyContext<T>(familyId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withTransaction(async (client) => {
    // 必须 SET LOCAL（事务结束自动清除）
    await client.query("SELECT set_config('app.family_id', $1, true)", [familyId]);
    // 角色切换为 boks_app
    await client.query("SET LOCAL ROLE boks_app");
    return fn(client);
  });
}
```

### 3.5 必须配置 RLS 的表（12 领域）

| 表 | RLS 列 | 策略名 | 特殊 |
|---|---|---|---|
| `boks_families` | `id` | `boks_families_self` | 仅自己 family |
| `boks_guardians` | `id` (via membership) | `boks_guardians_member` | 通过 `boks_family_memberships` |
| `boks_family_memberships` | `family_id` | `boks_memberships_family` | — |
| `boks_identity_bindings` | `family_id` | `boks_bindings_family` | — |
| `boks_guardian_sessions` | `family_id` | `boks_sessions_family` | — |
| `boks_children` | `family_id` | `boks_children_family_isolation` | 见 §3.3 |
| `boks_consents` | `family_id` | `boks_consents_family` | — |
| `boks_assessment_sessions` | `family_id` | `boks_assessment_sessions_family` | — |
| `boks_assessment_reports` | `family_id` | `boks_assessment_reports_family` | — |
| `boks_posture_sessions` | `family_id` | `boks_posture_sessions_family` | — |
| `boks_posture_assets` | `family_id` | `boks_posture_assets_family` | — |
| `boks_training_plans` | `family_id` | `boks_training_plans_family` | — |
| `boks_training_check_ins` | `family_id` | `boks_checkins_family` | — |
| `boks_chat_conversations` | `family_id` | `boks_chats_family` | — |
| `boks_chat_messages` | (via conversation) | `boks_chat_msgs_via_conv` | join 检查 |
| `boks_knowledge_chunks` | `published` | `boks_kb_chunks_published` | 仅 `status='published'` |
| `boks_standard_versions` | public | `boks_std_public` | 所有人可读 approved |
| `boks_audit_events` | `family_id` (nullable) | `boks_audit_family_or_null` | — |
| `boks_deletion_requests` | `family_id` | `boks_deletion_family` | — |

### 3.6 平台表 ACL（不走 RLS，用独立 ACL 角色）

```sql
-- migrations/0100_platform/0100_platform_documents.sql
ALTER TABLE boks_platform_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks_platform_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY boks_platform_owner_all ON boks_platform_documents TO boks_owner USING (true) WITH CHECK (true);
CREATE POLICY boks_platform_readonly ON boks_platform_documents TO boks_readonly FOR SELECT USING (true);
```

### 3.7 必须新增

| 文件 | 作用 |
|---|---|
| `services/api/src/db.ts` | `withFamilyContext` + `withTransaction` |
| `services/api/scripts/migrate.ts` | 迁移执行器 |
| `services/api/scripts/verify-migration.ts` | 校验 |
| 各 `migrations/00XX_*/00XX_*_rls.sql` | 12 领域策略 |

---

## 4. 字段级加密（pgcrypto + 信封加密）

### 4.1 设计决策

| 字段 | 加密方式 | 原因 |
|---|---|---|
| `boks_guardian_sessions.access_token_hash` | **HMAC-SHA256** 单向哈希 | 必须可验证 + 不可逆 |
| `boks_guardian_sessions.refresh_token_hash` | HMAC-SHA256 单向哈希 | 同上 |
| `boks_children.display_name` | **信封加密**（per-row DEK） | 实名需可还原 + 不可搜索 |
| `boks_children.birth_date` | 信封加密 | 出生日期需可还原 |
| `boks_posture_assets.storage_key` | 信封加密（高敏） | 含照片路径 |
| `boks_knowledge_versions.content` | **签名哈希**（content_hash） | 不可改 |
| `boks_identity_bindings.subject_hash` | HMAC-SHA256 | OpenID 不可逆 |
| `boks_audit_events.payload` 中敏感字段 | 信封加密 | 审计仍需可追溯 |
| `boks_chat_messages.content` | 客户端加密 + 服务端再加密 | 双层 |
| 备份文件 | pgcrypto + KMS 加密卷 | — |

### 4.2 KMS / 密钥管理

```sql
-- migrations/0120_security/0121_kms_key_registry.sql
CREATE TABLE IF NOT EXISTS boks_kms_keys (
  id              TEXT PRIMARY KEY,              -- "family-dek-v1"
  algorithm       TEXT NOT NULL,                 -- "aes-256-gcm"
  status          TEXT NOT NULL CHECK (status IN ('active','retired','revoked')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_from    TEXT REFERENCES boks_kms_keys(id),
  encrypted_dek   BYTEA NOT NULL,                -- 主密钥（KEK）加密的 DEK
  kek_id          TEXT NOT NULL,                 -- KEK 标识（来自 Vault/HSM）
  fingerprint     BYTEA NOT NULL                 -- SHA-256(plain DEK)
);

-- 应用启动时加载主密钥指纹到内存，禁止落库
```

**应用启动**：
```typescript
const kek = await vault.read("kek-prod-v1");        // 主密钥，永不落库
const dekPlain = await unwrap(kek, keyRow.encrypted_dek);
setInterval(() => rotateDek(), 1000 * 60 * 60 * 24 * 90);  // 90 天轮换
```

### 4.3 信封加密（per-row DEK）

```sql
-- migrations/0120_security/0122_field_encryption.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 通用加密函数（DEK 在应用层传入，PG 仅执行 AES）
CREATE OR REPLACE FUNCTION boks_encrypt(plaintext TEXT, dek BYTEA) RETURNS BYTEA
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN pgp_sym_encrypt(plaintext, encode(dek, 'hex'), 'cipher-algo=aes256');
END $$;

CREATE OR REPLACE FUNCTION boks_decrypt(ciphertext BYTEA, dek BYTEA) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN pgp_sym_decrypt(ciphertext, encode(dek, 'hex'), 'cipher-algo=aes256');
END $$;
```

**应用层调用**（示例：保存儿童姓名）：
```typescript
async function createChild(input: ChildInput): Promise<Child> {
  const familyId = currentFamilyId();
  const dek = await kms.getFamilyDek(familyId);  // 从 KMS 取 DEK
  return withFamilyContext(familyId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO boks_children(id, family_id, display_name_enc, birth_date_enc, ...)
       VALUES ($1,$2,boks_encrypt($3,$7),boks_encrypt($4::text,$7),...)
       RETURNING id, family_id, boks_decrypt(display_name_enc,$7) AS display_name`,
      [uuid(), familyId, input.displayName, input.birthDate, ..., dek]
    );
    return rows[0];
  });
}
```

### 4.4 必须新增

| 文件 | 作用 |
|---|---|
| `migrations/0120_security/0120_pgcrypto_setup.sql` | 扩展 + 函数 |
| `migrations/0120_security/0121_kms_key_registry.sql` | 密钥表 |
| `migrations/0120_security/0122_field_encryption.sql` | 加解密函数 |
| `services/api/src/security/kms.ts` | KMS 客户端（Vault/HSM 适配） |
| `services/api/src/security/envelope.ts` | 信封加解密 |
| `services/api/scripts/reencrypt.ts` | 密钥轮换脚本 |

### 4.5 密钥轮换流程

```
1. 新 KEK 上线（dual-key：旧 + 新并存）
2. 生成新 DEK
3. 应用层读所有行 → 用新 DEK 重加密 → 写回
4. 旧 DEK 标记 retired
5. 30 天后删除旧 DEK
6. 审计日志全量留痕
```

---

## 5. 备份恢复 / PITR

### 5.1 备份策略

| 类型 | 频率 | 保留 | 工具 |
|---|---|---|---|
| 物理全量 | 每日 03:00 | 30 天 | pg_basebackup |
| WAL 归档 | 实时 | 30 天 | `archive_mode = on` |
| 逻辑全量 | 每周日 03:00 | 12 周 | pg_dump |
| 逻辑增量（关键表） | 每日 03:30 | 90 天 | pg_dump --table=... |
| 备份加密 | 写入前 | — | AES-256-GCM with KEK |
| 备份校验 | 每周六 04:00 | — | pg_restore --list |

### 5.2 脚本

```bash
# scripts/backup.sh
#!/usr/bin/env bash
set -euo pipefail
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/var/backups/boks
mkdir -p "$BACKUP_DIR"

# 物理基备
pg_basebackup -D "$BACKUP_DIR/base_$TS" -Ft -z -P -U boks_owner

# 逻辑全量（仅 schema + 数据，不含大对象）
pg_dump -U boks_owner -Fc --no-owner --no-privileges \
  -f "$BACKUP_DIR/logic_$TS.dump" boks

# 加密
openssl enc -aes-256-gcm -salt -pbkdf2 \
  -in "$BACKUP_DIR/logic_$TS.dump" \
  -out "$BACKUP_DIR/logic_$TS.dump.enc" \
  -pass file:/etc/boks/backup.pass

# 上传 S3
aws s3 cp "$BACKUP_DIR/logic_$TS.dump.enc" s3://boks-prod-backups/logic/

# 清理 > 30 天
find "$BACKUP_DIR" -mtime +30 -delete

# 校验日志
echo "[$TS] backup ok logic=$TS" >> /var/log/boks/backup.log
```

### 5.3 PITR（Point-in-Time Recovery）

```bash
# scripts/restore.sh
#!/usr/bin/env bash
set -euo pipefail
TARGET=$1  # "2026-08-01 14:30:00"

# 1. 恢复最近全量
pg_restore -U boks_owner -d boks /var/backups/boks/logic_latest.dump

# 2. 应用 WAL 至目标时间
psql -U boks_owner -c "SELECT pg_wal_replay_resume();" &
RECOVERY_PID=$!
# 通过 recovery.conf 指定 target_time
cat > /var/lib/postgresql/recovery.conf <<EOF
restore_command = 'cp /var/wal_archive/%f %p'
recovery_target_time = '$TARGET'
recovery_target_inclusive = true
EOF

# 3. 监控进度
while kill -0 $RECOVERY_PID 2>/dev/null; do
  sleep 5
done
```

### 5.4 季度演练

```
每季度：
1. 选取过去 30 天内某时间点
2. 在隔离环境恢复
3. 验证关键数据完整（家庭数、儿童数、最近报告数）
4. 写入演练报告
```

---

## 6. 索引与查询优化

### 6.1 必须索引清单

```sql
-- 高频查询索引
CREATE INDEX IF NOT EXISTS boks_assessment_sessions_child_date_idx
  ON boks_assessment_sessions (child_id, measurement_date DESC);

CREATE INDEX IF NOT EXISTS boks_assessment_reports_child_date_idx
  ON boks_assessment_reports (child_id, measurement_date DESC);

CREATE INDEX IF NOT EXISTS boks_posture_sessions_child_status_idx
  ON boks_posture_sessions (child_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS boks_training_check_ins_plan_day_idx
  ON boks_training_check_ins (plan_id, day);

CREATE INDEX IF NOT EXISTS boks_chat_conversations_family_created_idx
  ON boks_chat_conversations (family_id, created_at DESC);

CREATE INDEX IF NOT EXISTS boks_chat_messages_conv_created_idx
  ON boks_chat_messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS boks_knowledge_chunks_published_idx
  ON boks_knowledge_versions (status, published_at DESC)
  WHERE status = 'published';

-- 向量索引（pgvector）
CREATE INDEX IF NOT EXISTS boks_chunks_embedding_idx
  ON boks_knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 部分索引（按 status 过滤）
CREATE INDEX IF NOT EXISTS boks_deletion_requests_pending_idx
  ON boks_deletion_requests (created_at)
  WHERE status = 'pending';
```

### 6.2 查询优化（`EXPLAIN ANALYZE` 验证）

| 场景 | 期望 |
|---|---|
| 单家庭最近 10 次体测 | < 20ms |
| 单儿童最近 5 次训练打卡 | < 10ms |
| 知识库语义检索 top 6 | < 80ms |
| 体态报告列表（按儿童） | < 30ms |
| 审计按家庭按时间 | < 50ms |

### 6.3 连接池

```yaml
# PgBouncer 配置（docker-compose）
pool_mode: transaction
max_client_conn: 1000
default_pool_size: 25
reserve_pool_size: 5
server_idle_timeout: 600
query_timeout: 30
client_idle_timeout: 0
```

---

## 7. 审计与可追溯

### 7.1 `boks_audit_events` 升级

```sql
-- migrations/0110_audit/0110_audit_events.sql
ALTER TABLE boks_audit_events
  ADD COLUMN actor_type   TEXT NOT NULL DEFAULT 'guardian' CHECK (actor_type IN ('guardian','admin','staff','system','ai_agent','cron')),
  ADD COLUMN actor_id     TEXT,
  ADD COLUMN target_type  TEXT,                  -- "child" / "report" / "knowledge_version"
  ADD COLUMN target_id    TEXT,
  ADD COLUMN ip           INET,
  ADD COLUMN user_agent   TEXT,
  ADD COLUMN request_id   TEXT,                  -- 对应 traceparent
  ADD COLUMN outcome      TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success','failure','denied')),
  ADD COLUMN error_code   TEXT,
  ADD COLUMN payload_enc  BYTEA,                 -- 敏感 payload 信封加密
  ADD COLUMN prev_hash    BYTEA,                 -- 哈希链（防篡改）
  ADD COLUMN row_hash     BYTEA NOT NULL;        -- sha256(prev + payload)

CREATE INDEX boks_audit_family_created_idx ON boks_audit_events (family_id, created_at DESC);
CREATE INDEX boks_audit_target_idx ON boks_audit_events (target_type, target_id);
CREATE INDEX boks_audit_actor_idx ON boks_audit_events (actor_type, actor_id);
```

### 7.2 哈希链（防篡改）

```sql
CREATE OR REPLACE FUNCTION boks_audit_compute_hash() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  prev BYTEA;
BEGIN
  SELECT row_hash INTO prev FROM boks_audit_events
    WHERE family_id IS NOT DISTINCT FROM NEW.family_id
    ORDER BY created_at DESC, id DESC LIMIT 1
    FOR UPDATE;
  NEW.prev_hash := COALESCE(prev, '\x'::bytea);
  NEW.row_hash := digest(
    NEW.prev_hash || NEW.id::bytea || convert_to(NEW.action || COALESCE(NEW.payload::text,''), 'UTF8'),
    'sha256'
  );
  RETURN NEW;
END $$;

CREATE TRIGGER boks_audit_hash_chain BEFORE INSERT ON boks_audit_events
  FOR EACH ROW EXECUTE FUNCTION boks_audit_compute_hash();
```

### 7.3 必须审计的事件

| action | 触发 |
|---|---|
| `family.create` / `family.archive` / `family.delete` | 家庭创建/归档/删除 |
| `guardian.invite` / `guardian.revoke` | 监护人邀请/吊销 |
| `child.create` / `child.update` / `child.archive` / `child.delete` | 儿童档案 |
| `consent.grant` / `consent.withdraw` | 同意 |
| `assessment.create` / `assessment.update` | 体测 |
| `posture.create` / `posture.upload` / `posture.report_view` | 体态 |
| `training.plan_create` / `training.check_in` / `training.plan_pause` | 训练 |
| `chat.create` / `chat.message_send` / `chat.message_view` | 咨询 |
| `knowledge.publish` / `knowledge.retire` / `knowledge.view` | 知识库 |
| `ai.chat_request` / `ai.tool_call` / `ai.safety_intercept` | AI |
| `admin.login` / `admin.role_change` | 管理员 |
| `data.export` / `data.delete` | 数据导出/删除 |
| `crypto.key_rotate` | 密钥轮换 |

### 7.4 必须新增

| 文件 | 作用 |
|---|---|
| `services/api/src/audit/logger.ts` | 审计 logger |
| `services/api/src/audit/verify-chain.ts` | 哈希链校验工具 |

---

## 8. 与 NestJS 仓储层集成

### 8.1 当前状态

`storage.ts:413-1184` `syncRelationalTables()` JSON + 关系表双写（37K 字节）。

### 8.2 升级：移除 JSON 双写，统一关系表

```typescript
// services/api/src/repositories/family.repository.ts
import { Pool, PoolClient } from "pg";
import { withFamilyContext } from "../db.js";
import { kmsDecrypt } from "../security/kms.js";

export class FamilyRepository {
  constructor(private pool: Pool) {}
  async getChildren(familyId: string): Promise<Child[]> {
    return withFamilyContext(familyId, async (client) => {
      const dek = await kms.getFamilyDek(familyId);
      const { rows } = await client.query(
        `SELECT id,
                boks_decrypt(display_name_enc, $2::bytea) AS display_name,
                boks_decrypt(birth_date_enc, $2::bytea)::date AS birth_date,
                sex_code, school_stage, grade_code, profile_status, payload
         FROM boks_children
         WHERE profile_status = 'active'
         ORDER BY created_at`
      , [familyId, dek]);
      return rows.map(toChild);
    });
  }
  // ...
}
```

### 8.3 事务边界

```typescript
// 写操作必须事务
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
```

### 8.4 迁移检查表

| 旧位置 | 新位置 |
|---|---|
| `demo-store.ts:37901` JSON | 各 `*.repository.ts` |
| `storage.ts:413-1184` syncRelationalTables | 删除（迁移完成） |
| `runtime-config.ts` BOKS_DATA_FILE | 保留 fallback 但生产禁止 |

---

## 9. 测试与演练

### 9.1 迁移测试

```typescript
// services/api/tests/migrations/migration.test.ts
describe("migrations", () => {
  it("must apply all migrations in order", async () => { /* ... */ });
  it("must enforce RLS on all family tables", async () => {
    const tables = ["boks_children", "boks_assessment_sessions", /*...*/];
    for (const t of tables) {
      const { rows } = await pool.query(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname=$1`, [t]
      );
      expect(rows[0].relrowsecurity).toBe(true);
      expect(rows[0].relforcerowsecurity).toBe(true);
    }
  });
  it("must fail when checksum drifts", async () => { /* ... */ });
  it("must provide DOWN for each migration", async () => { /* ... */ });
});
```

### 9.2 RLS 测试

```typescript
describe("RLS enforcement", () => {
  it("family A cannot read family B's children", async () => {
    await setupFamily("A", "child-A1");
    await setupFamily("B", "child-B1");
    await withFamilyContext("A", async (client) => {
      const { rows } = await client.query("SELECT id FROM boks_children");
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("child-A1");
    });
  });
  it("cannot bypass with superuser-style connection", async () => { /* ... */ });
});
```

### 9.3 加密测试

```typescript
describe("envelope encryption", () => {
  it("display_name stored as ciphertext, not plaintext", async () => {
    await createChild({ displayName: "小明" });
    const { rows } = await pool.query(
      `SELECT display_name_enc, pg_typeof(display_name_enc) FROM boks_children LIMIT 1`
    );
    expect(rows[0].display_name_enc).toBeInstanceOf(Buffer);
    expect(rows[0].display_name_enc.toString()).not.toContain("小明");
  });
  it("key rotation produces new ciphertexts, old still decryptable", async () => { /* ... */ });
});
```

### 9.4 备份恢复演练

```
每季度：
1. 在 staging 环境还原生产快照（脱敏后）
2. PITR 至 24h 前
3. 校验关键数据 + 审计链完整
4. 输出报告 + 修复发现的问题
```

---

## 10. 落地执行（接续 17 阶段 2）

> 与 `docs/17` §阶段 2 并行扩展；**新增**任务用 `[NEW]` 标注。

| 周次 | 任务 | 交付物 | 验收 |
|---|---|---|---|
| W1 D1-2 | 拆分 001 → 13 个领域 migration | `migrations/0001..0140/*` | 文件数 ≥ 60 |
| W1 D3 | schema_migrations + migrate.ts | `0002_schema_migrations.sql` + `scripts/migrate.ts` | 顺序执行 + checksum 校验 |
| W1 D4-5 | app_user/owner/readonly 角色 | `0003_app_user.sql` | 权限最小化 |
| W2 D1-2 | RLS：identity + children | `0010..0030/*_rls.sql` | 跨家庭查询 100% 隔离 |
| W2 D3-4 | RLS：assessment + posture + training | `0040..0060/*_rls.sql` | 同上 |
| W2 D5 | RLS：chat + knowledge + audit + standard | `0070..0110/*_rls.sql` | 同上 |
| W3 D1-2 | pgcrypto + KMS key registry | `0120_security/*` | 加密函数可调用 |
| W3 D3-4 | 字段加密接入（children.display_name / birth_date / posture storage_key） | `services/api/src/security/*` | 数据库中无明文 |
| W3 D5 | **[NEW]** 哈希链审计触发器 | `0110_audit_events.sql` 触发器 | 哈希链连续 |
| W4 D1-2 | NestJS 仓储层重构（移除 JSON 双写） | `services/api/src/repositories/*` | 关系表单一存储 |
| W4 D3 | withFamilyContext + withTransaction | `services/api/src/db.ts` | 所有写走事务 |
| W4 D4-5 | **[NEW]** 索引 + EXPLAIN ANALYZE 验证 | 索引清单 + 报告 | 关键查询 < 50ms |
| W5 D1-2 | 备份脚本 + S3 上传 + 加密 | `scripts/backup.sh` | 端到端验证 |
| W5 D3 | PITR 脚本 + 演练 | `scripts/restore.sh` + 演练报告 | 恢复时间 < 1h |
| W5 D4 | **[NEW]** 季度演练 Runbook | `docs/runbook/backup-restore.md` | 季度演练闭环 |
| W5 D5 | **[NEW]** 测试（迁移/RLS/加密） | `tests/migrations/*` | 覆盖率 100% |

**人力**：
- 1 名后端组长（NestJS + DB）× 5 周
- 1 名后端工程师（DB + 加密）× 5 周
- 1 名 DBA 顾问 × 1 周（备份恢复演练 + 性能基线）
- 1 名 QA × 2 周（RLS/加密测试）

---

## 附录 A：完整 migration 清单

```
序号   路径                                             内容                                            状态
0001   0001_core/0001_extensions.sql                     pgcrypto / uuid-ossp / pgvector / citext       待建
0002   0001_core/0002_schema_migrations.sql              迁移版本表                                       待建
0003   0001_core/0003_app_user.sql                       角色 + 权限                                       待建
0010   0010_identity/0010_families.sql                   家庭表                                           待建
0011   0010_identity/0011_guardians.sql                  监护人                                           待建
0012   0010_identity/0012_memberships.sql                成员关系                                         待建
0013   0010_identity/0013_identity_bindings.sql          身份绑定                                         待建
0014   0010_identity/0014_guardian_sessions.sql          会话                                             待建
0020   0020_consent/0020_consents.sql                    同意记录                                         待建
0030   0030_children/0030_children.sql                   儿童档案 + RLS                                   待建
0040   0040_assessment/0040_sessions.sql                 体测 session + RLS                              待建
0041   0040_assessment/0041_reports.sql                  体测报告 + RLS                                   待建
0050   0050_posture/0050_sessions.sql                    体态 session + RLS                               待建
0051   0050_posture/0051_assets.sql                      体态资产 + RLS                                   待建
0052   0050_posture/0052_reports.sql                     体态报告 + RLS                                   待建
0060   0060_training/0060_plans.sql                      训练计划 + RLS                                   待建
0061   0060_training/0061_check_ins.sql                  训练打卡 + RLS                                   待建
0070   0070_chat/0070_conversations.sql                  对话 + RLS                                       待建
0071   0070_chat/0071_messages.sql                      对话消息 + RLS                                   待建
0080   0080_knowledge/0080_sources.sql                   知识来源                                         待建
0081   0080_knowledge/0081_versions.sql                  知识版本                                         待建
0082   0080_knowledge/0082_chunks.sql                    切片 + 向量                                      待建
0083   0080_knowledge/0083_embeddings.sql                pgvector 索引                                    待建
0090   0090_standards/0090_versions.sql                  标准版本                                         待建
0091   0090_standards/0091_indicators.sql                指标                                             待建
0092   0090_standards/0092_score_bands.sql               评分档位                                         待建
0093   0090_standards/0093_rules.sql                    评分规则                                         待建
0100   0100_platform/0100_platform_documents.sql         平台文档（知识配置）                              待建
0110   0110_audit/0110_audit_events.sql                  审计（含哈希链）                                  待建
0111   0110_audit/0111_deletion_requests.sql             删除请求                                         待建
0120   0120_security/0120_pgcrypto_setup.sql             pgcrypto 函数                                    待建
0121   0120_security/0121_kms_key_registry.sql           KMS 密钥注册表                                   待建
0122   0120_security/0122_field_encryption.sql           字段加密函数                                     待建
0130   0130_ai/0130_prompt_versions.sql                  Prompt 版本表                                    待建
0131   0130_ai/0131_llm_usage.sql                        LLM 用量                                         待建
0132   0130_ai/0132_agent_traces.sql                     Agent trace                                      待建
0133   0130_ai/0133_cost_daily.sql                       成本物化视图                                     待建
0140   0140_idempotency/0140_idempotency_keys.sql        幂等键表                                         待建
```

**合计**：38 个 migration 文件（替代现有 1 个文件）。

---

> **下一步**：本方案审批后，启动阶段 2 第一周（拆分 migration + 角色）；5 周后生产环境 RLS 全覆盖 + 字段加密 + 备份恢复演练闭环。