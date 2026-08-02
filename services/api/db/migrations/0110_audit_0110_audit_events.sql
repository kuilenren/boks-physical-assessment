-- migrations/0110_audit/0110_audit_events.sql
-- 依赖：0010_families
-- 说明：审计事件（哈希链防篡改 + envelope 加密 payload）
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_audit_events (
  id              TEXT PRIMARY KEY,
  family_id       TEXT,                          -- 平台事件可空
  actor_type      TEXT NOT NULL DEFAULT 'guardian'
                  CHECK (actor_type IN ('guardian','admin','staff','system','ai_agent','cron')),
  actor_id        TEXT,
  target_type     TEXT,
  target_id       TEXT,
  action          TEXT NOT NULL,
  ip              INET,
  user_agent      TEXT,
  request_id      TEXT,
  outcome         TEXT NOT NULL DEFAULT 'success'
                  CHECK (outcome IN ('success','failure','denied')),
  error_code      TEXT,
  payload_enc     BYTEA,
  prev_hash       BYTEA,
  row_hash        BYTEA NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_audit_family_created_idx
  ON boks.boks_audit_events (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS boks_audit_target_idx
  ON boks.boks_audit_events (target_type, target_id);
CREATE INDEX IF NOT EXISTS boks_audit_actor_idx
  ON boks.boks_audit_events (actor_type, actor_id);

ALTER TABLE boks.boks_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_audit_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_audit_owner ON boks.boks_audit_events;
CREATE POLICY boks_audit_owner ON boks.boks_audit_events
  TO boks_owner USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS boks_audit_readonly ON boks.boks_audit_events;
CREATE POLICY boks_audit_readonly ON boks.boks_audit_events
  TO boks_readonly USING (true);

-- boks_app 不能直接 INSERT（由专用审计 logger 用 SET ROLE boks_owner 写入）
DROP POLICY IF EXISTS boks_audit_app_none ON boks.boks_audit_events;
CREATE POLICY boks_audit_app_none ON boks.boks_audit_events
  TO boks_app USING (false) WITH CHECK (false);

GRANT SELECT ON boks.boks_audit_events TO boks_readonly;

-- 哈希链触发器：每行写入时 prev_hash = 上一行的 row_hash
CREATE OR REPLACE FUNCTION boks.boks_audit_compute_hash()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  prev BYTEA;
BEGIN
  SELECT row_hash INTO prev FROM boks.boks_audit_events
    WHERE family_id IS NOT DISTINCT FROM NEW.family_id
    ORDER BY created_at DESC, id DESC LIMIT 1;
  NEW.prev_hash := COALESCE(prev, decode('', 'hex'));
  NEW.row_hash := digest(
    COALESCE(prev, decode('', 'hex')) || convert_to(NEW.id, 'UTF8') ||
    convert_to(NEW.action || COALESCE(NEW.payload_enc::text, ''), 'UTF8'),
    'sha256'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS boks_audit_hash_chain ON boks.boks_audit_events;
CREATE TRIGGER boks_audit_hash_chain BEFORE INSERT ON boks.boks_audit_events
  FOR EACH ROW EXECUTE PROCEDURE boks.boks_audit_compute_hash();

-- DOWN
DROP TRIGGER IF EXISTS boks_audit_hash_chain ON boks.boks_audit_events;
DROP FUNCTION IF EXISTS boks.boks_audit_compute_hash();
DROP TABLE IF EXISTS boks.boks_audit_events;