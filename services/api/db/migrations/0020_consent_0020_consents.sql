-- migrations/0020_consent/0020_consents.sql
-- 依赖：0010_families, 0030_children
-- 说明：监护人同意记录（隐私/体测/照片/语音 等 purpose），按版本管理
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_consents (
  id           TEXT PRIMARY KEY,
  family_id    TEXT NOT NULL REFERENCES boks.boks_families(id) ON DELETE CASCADE,
  child_id     TEXT,                  -- 部分同意（privacy）不绑定儿童
  purpose      TEXT NOT NULL CHECK (purpose IN ('privacy','assessment','photo','voice','training')),
  version      TEXT NOT NULL,         -- 隐私政策版本号
  granted      BOOLEAN NOT NULL,
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS boks_consents_family_purpose_idx
  ON boks.boks_consents (family_id, purpose, version);

ALTER TABLE boks.boks_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_consents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_consents_family ON boks.boks_consents;
CREATE POLICY boks_consents_family ON boks.boks_consents
  USING (family_id = current_setting('app.family_id', true))
  WITH CHECK (family_id = current_setting('app.family_id', true));

DROP POLICY IF EXISTS boks_consents_owner ON boks.boks_consents;
CREATE POLICY boks_consents_owner ON boks.boks_consents
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_consents TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_consents;