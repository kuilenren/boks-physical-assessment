-- migrations/0010_identity/0011_guardians.sql
-- 依赖：0010_families
-- 说明：监护人表 + RLS（通过 membership 间接隔离）
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_guardians (
  id              TEXT PRIMARY KEY,
  display_name    TEXT,
  email           CITEXT,
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','disabled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_guardians_phone_idx ON boks.boks_guardians (phone);

ALTER TABLE boks.boks_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_guardians FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_guardians_owner ON boks.boks_guardians;
CREATE POLICY boks_guardians_owner ON boks.boks_guardians
  TO boks_owner USING (true) WITH CHECK (true);

-- 应用层通过 membership 限制，普通 boks_app 角色完全拒绝
DROP POLICY IF EXISTS boks_guardians_app_none ON boks.boks_guardians;
CREATE POLICY boks_guardians_app_none ON boks.boks_guardians
  TO boks_app USING (false) WITH CHECK (false);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_guardians TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_guardians;