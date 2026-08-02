-- migrations/0010_identity/0012_memberships.sql
-- 依赖：0010_families, 0011_guardians
-- 说明：家庭成员关系
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_family_memberships (
  family_id   TEXT NOT NULL REFERENCES boks.boks_families(id) ON DELETE CASCADE,
  guardian_id TEXT NOT NULL REFERENCES boks.boks_guardians(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner','guardian','viewer')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (family_id, guardian_id)
);
CREATE INDEX IF NOT EXISTS boks_memberships_guardian_idx
  ON boks.boks_family_memberships (guardian_id) WHERE status = 'active';

ALTER TABLE boks.boks_family_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_family_memberships FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_memberships_family ON boks.boks_family_memberships;
CREATE POLICY boks_memberships_family ON boks.boks_family_memberships
  USING (family_id = current_setting('app.family_id', true))
  WITH CHECK (family_id = current_setting('app.family_id', true));

DROP POLICY IF EXISTS boks_memberships_owner ON boks.boks_family_memberships;
CREATE POLICY boks_memberships_owner ON boks.boks_family_memberships
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_family_memberships TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_family_memberships;