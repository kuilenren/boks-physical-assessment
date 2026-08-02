-- migrations/0050_posture/0051_assets.sql
-- 依赖：0050_sessions
-- 说明：体态资产（4 视角照片），storage_key 走 envelope 加密
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_posture_assets (
  id                TEXT PRIMARY KEY,
  family_id         TEXT NOT NULL REFERENCES boks.boks_families(id) ON DELETE CASCADE,
  session_id        TEXT NOT NULL REFERENCES boks.boks_posture_sessions(id) ON DELETE CASCADE,
  view_code         TEXT NOT NULL CHECK (view_code IN ('front','back','left','right')),
  storage_key_enc   BYTEA NOT NULL,
  checksum_sha256   TEXT,
  byte_size         INTEGER,
  mime_type         TEXT,
  quality_status    TEXT NOT NULL DEFAULT 'pending'
                    CHECK (quality_status IN ('pending','passed','needs_retake')),
  quality_score     NUMERIC(3,2),
  quality_reasons   JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_posture_assets_session_view_idx
  ON boks.boks_posture_assets (session_id, view_code);

ALTER TABLE boks.boks_posture_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_posture_assets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_posture_assets_family ON boks.boks_posture_assets;
CREATE POLICY boks_posture_assets_family ON boks.boks_posture_assets
  USING (family_id = current_setting('app.family_id', true))
  WITH CHECK (family_id = current_setting('app.family_id', true));

DROP POLICY IF EXISTS boks_posture_assets_owner ON boks.boks_posture_assets;
CREATE POLICY boks_posture_assets_owner ON boks.boks_posture_assets
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_posture_assets TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_posture_assets;