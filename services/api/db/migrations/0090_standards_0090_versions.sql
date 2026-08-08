-- migrations/0090_standards/0090_versions.sql
-- 依赖：0001_extensions
-- 说明：标准版本（demo_pending_review / approved）
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_standard_versions (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'demo_pending_review'
                  CHECK (status IN ('approved','demo_pending_review','retired')),
  mode            TEXT NOT NULL DEFAULT 'scored'
                  CHECK (mode IN ('scored','reference_only')),
  source_references JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviewers       JSONB NOT NULL DEFAULT '[]'::jsonb,
  approvers       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE boks.boks_standard_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_standard_versions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_standard_versions_public_read ON boks.boks_standard_versions;
CREATE POLICY boks_standard_versions_public_read ON boks.boks_standard_versions
  USING (true);

DROP POLICY IF EXISTS boks_standard_versions_owner ON boks.boks_standard_versions;
CREATE POLICY boks_standard_versions_owner ON boks.boks_standard_versions
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT ON boks.boks_standard_versions TO boks_app, boks_readonly;
GRANT INSERT, UPDATE, DELETE ON boks.boks_standard_versions TO boks_owner;

-- DOWN
DROP TABLE IF EXISTS boks.boks_standard_versions;