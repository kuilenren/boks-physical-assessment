-- migrations/0140_idempotency/0140_idempotency_keys.sql
-- 依赖：0001_extensions
-- 说明：幂等键表（client 提供 Idempotency-Key，24h 内同 key 同 payload 返回缓存结果）
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_idempotency_keys (
  key_hash         TEXT PRIMARY KEY,                -- sha256(key + route)
  method           TEXT NOT NULL,
  route            TEXT NOT NULL,
  request_hash     TEXT NOT NULL,                   -- sha256(payload)
  response_status  INTEGER NOT NULL,
  response_body    JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS boks_idempotency_expires_idx
  ON boks.boks_idempotency_keys (expires_at);

ALTER TABLE boks.boks_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_idempotency_keys FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_idempotency_owner ON boks.boks_idempotency_keys;
CREATE POLICY boks_idempotency_owner ON boks.boks_idempotency_keys
  TO boks_owner USING (true) WITH CHECK (true);

GRANT INSERT, UPDATE, DELETE ON boks.boks_idempotency_keys TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_idempotency_keys;