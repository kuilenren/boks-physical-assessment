-- migrations/0010_identity/0014_guardian_sessions.sql
-- 依赖：0013_identity_bindings
-- 说明：会话表，token 仅存 HMAC-SHA256
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_guardian_sessions (
  access_token_hash   TEXT PRIMARY KEY,
  refresh_token_hash  TEXT NOT NULL UNIQUE,
  guardian_id         TEXT NOT NULL REFERENCES boks.boks_guardians(id) ON DELETE CASCADE,
  family_id           TEXT NOT NULL REFERENCES boks.boks_families(id) ON DELETE CASCADE,
  account_id          TEXT,
  role                TEXT,
  org_id              TEXT,
  expires_at          TIMESTAMPTZ NOT NULL,
  refresh_expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_sessions_family_idx
  ON boks.boks_guardian_sessions (family_id, guardian_id);
CREATE INDEX IF NOT EXISTS boks_sessions_expires_idx
  ON boks.boks_guardian_sessions (expires_at) WHERE revoked_at IS NULL;

ALTER TABLE boks.boks_guardian_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_guardian_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_sessions_family ON boks.boks_guardian_sessions;
CREATE POLICY boks_sessions_family ON boks.boks_guardian_sessions
  USING (family_id = current_setting('app.family_id', true))
  WITH CHECK (family_id = current_setting('app.family_id', true));

DROP POLICY IF EXISTS boks_sessions_owner ON boks.boks_guardian_sessions;
CREATE POLICY boks_sessions_owner ON boks.boks_guardian_sessions
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_guardian_sessions TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_guardian_sessions;