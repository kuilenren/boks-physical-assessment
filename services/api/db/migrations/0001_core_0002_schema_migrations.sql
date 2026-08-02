-- migrations/0001_core/0002_schema_migrations.sql
-- 依赖：0001_extensions
-- 说明：迁移版本表（执行顺序 + checksum 校验 + DOWN 落库）
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_schema_migrations (
  id              TEXT PRIMARY KEY,
  version         INTEGER NOT NULL,
  domain          TEXT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by      TEXT NOT NULL,
  duration_ms     INTEGER NOT NULL,
  rollback_sql    TEXT,
  UNIQUE (domain, version)
);
CREATE INDEX IF NOT EXISTS boks_schema_migrations_applied_idx
  ON boks.boks_schema_migrations (applied_at DESC);

-- DOWN
DROP TABLE IF EXISTS boks.boks_schema_migrations;