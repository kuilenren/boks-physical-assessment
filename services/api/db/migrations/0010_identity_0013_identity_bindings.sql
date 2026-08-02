-- migrations/0010_identity/0013_identity_bindings.sql
-- 依赖：0012_memberships
-- 说明：第三方登录绑定（微信 OpenID、手机号等），subject 用 HMAC 哈希
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_identity_bindings (
  provider      TEXT NOT NULL,                 -- 'wechat' / 'phone' / 'dev'
  subject_hash  TEXT NOT NULL,                 -- HMAC-SHA256(KEK, subject)
  guardian_id   TEXT NOT NULL REFERENCES boks.boks_guardians(id) ON DELETE CASCADE,
  family_id     TEXT NOT NULL REFERENCES boks.boks_families(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, subject_hash)
);
CREATE INDEX IF NOT EXISTS boks_bindings_guardian_idx
  ON boks.boks_identity_bindings (guardian_id);

ALTER TABLE boks.boks_identity_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_identity_bindings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_bindings_family ON boks.boks_identity_bindings;
CREATE POLICY boks_bindings_family ON boks.boks_identity_bindings
  USING (family_id = current_setting('app.family_id', true))
  WITH CHECK (family_id = current_setting('app.family_id', true));

DROP POLICY IF EXISTS boks_bindings_owner ON boks.boks_identity_bindings;
CREATE POLICY boks_bindings_owner ON boks.boks_identity_bindings
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_identity_bindings TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_identity_bindings;