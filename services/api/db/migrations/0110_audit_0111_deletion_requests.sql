-- migrations/0110_audit/0111_deletion_requests.sql
-- 依赖：0030_children
-- 说明：数据删除工单（含 proof 哈希，用于审计）
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_deletion_requests (
  id                    TEXT PRIMARY KEY,
  family_id             TEXT NOT NULL REFERENCES boks.boks_families(id) ON DELETE CASCADE,
  child_id              TEXT REFERENCES boks.boks_children(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','in_progress','completed','failed')),
  scope                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at          TIMESTAMPTZ,
  deleted_asset_count   INTEGER NOT NULL DEFAULT 0,
  proof_hash            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_deletion_requests_family_idx
  ON boks.boks_deletion_requests (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS boks_deletion_requests_pending_idx
  ON boks.boks_deletion_requests (created_at) WHERE status = 'pending';

ALTER TABLE boks.boks_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_deletion_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_deletion_family ON boks.boks_deletion_requests;
CREATE POLICY boks_deletion_family ON boks.boks_deletion_requests
  USING (family_id = current_setting('app.family_id', true))
  WITH CHECK (family_id = current_setting('app.family_id', true));

DROP POLICY IF EXISTS boks_deletion_owner ON boks.boks_deletion_requests;
CREATE POLICY boks_deletion_owner ON boks.boks_deletion_requests
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_deletion_requests TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_deletion_requests;