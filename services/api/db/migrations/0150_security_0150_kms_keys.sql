-- migrations/0150_security/0150_kms_keys.sql
-- 说明：KMS 密钥注册表。每个 family 一个 DEK，被 KEK 包裹后存储。
-- 依赖：0001_extensions、0010_families
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_kms_keys (
  family_id   TEXT PRIMARY KEY,
  kek_id      TEXT NOT NULL,
  wrapped_dek BYTEA NOT NULL,
  iv          BYTEA NOT NULL,
  auth_tag    BYTEA NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','rotating','retired')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_kms_keys TO boks_app;
GRANT SELECT ON boks.boks_kms_keys TO boks_readonly;

-- DOWN
DROP TABLE IF EXISTS boks.boks_kms_keys;
