-- Direct schema creation for missing tables (audit, deletion_requests, llm_usage, prompt_versions, agent_traces, idempotency_keys)
SET client_min_messages = WARNING;

-- boks_audit_events extras
CREATE INDEX IF NOT EXISTS boks_audit_family_created_idx ON boks.boks_audit_events (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS boks_audit_target_idx ON boks.boks_audit_events (target_type, target_id);
CREATE INDEX IF NOT EXISTS boks_audit_actor_idx ON boks.boks_audit_events (actor_type, actor_id);
ALTER TABLE boks.boks_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_audit_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS boks_audit_owner ON boks.boks_audit_events;
CREATE POLICY boks_audit_owner ON boks.boks_audit_events TO boks_owner USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS boks_audit_readonly ON boks.boks_audit_events;
CREATE POLICY boks_audit_readonly ON boks.boks_audit_events TO boks_readonly USING (true);
DROP POLICY IF EXISTS boks_audit_app_none ON boks.boks_audit_events;
CREATE POLICY boks_audit_app_none ON boks.boks_audit_events TO boks_app USING (false) WITH CHECK (false);
GRANT SELECT ON boks.boks_audit_events TO boks_readonly;
CREATE OR REPLACE FUNCTION boks.boks_audit_compute_hash() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE prev BYTEA;
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

-- boks_deletion_requests
CREATE TABLE IF NOT EXISTS boks.boks_deletion_requests (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES boks.boks_families(id) ON DELETE CASCADE,
  child_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed')),
  scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ,
  deleted_asset_count INTEGER NOT NULL DEFAULT 0,
  proof_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_deletion_requests_family_idx ON boks.boks_deletion_requests (family_id, created_at DESC);
ALTER TABLE boks.boks_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_deletion_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS boks_deletion_family ON boks.boks_deletion_requests;
CREATE POLICY boks_deletion_family ON boks.boks_deletion_requests
  USING (family_id = current_setting('app.family_id', true))
  WITH CHECK (family_id = current_setting('app.family_id', true));
DROP POLICY IF EXISTS boks_deletion_owner ON boks.boks_deletion_requests;
CREATE POLICY boks_deletion_owner ON boks.boks_deletion_requests TO boks_owner USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_deletion_requests TO boks_app;

-- boks_llm_usage
CREATE TABLE IF NOT EXISTS boks.boks_llm_usage (
  id TEXT PRIMARY KEY,
  family_id TEXT,
  conversation_id TEXT,
  model TEXT NOT NULL,
  task TEXT NOT NULL CHECK (task IN ('chat','classify','rerank','summary','extract','embed')),
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_cny NUMERIC(10,6) NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_llm_usage_family_day_idx ON boks.boks_llm_usage (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS boks_llm_usage_model_idx ON boks.boks_llm_usage (model, created_at DESC);
ALTER TABLE boks.boks_llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_llm_usage FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS boks_llm_usage_owner ON boks.boks_llm_usage;
CREATE POLICY boks_llm_usage_owner ON boks.boks_llm_usage TO boks_owner USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS boks_llm_usage_readonly ON boks.boks_llm_usage;
CREATE POLICY boks_llm_usage_readonly ON boks.boks_llm_usage TO boks_readonly USING (true);

-- boks_prompt_versions
CREATE TABLE IF NOT EXISTS boks.boks_prompt_versions (
  id TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  version INTEGER NOT NULL,
  tone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','canary','active','retired')),
  yaml_body TEXT NOT NULL,
  change_note TEXT NOT NULL,
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  UNIQUE (family, tone, version)
);
ALTER TABLE boks.boks_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_prompt_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS boks_prompt_versions_owner ON boks.boks_prompt_versions;
CREATE POLICY boks_prompt_versions_owner ON boks.boks_prompt_versions TO boks_owner USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS boks_prompt_versions_active_read ON boks.boks_prompt_versions;
CREATE POLICY boks_prompt_versions_active_read ON boks.boks_prompt_versions USING (status IN ('active','canary'));
GRANT SELECT ON boks.boks_prompt_versions TO boks_app, boks_readonly;

-- boks_agent_traces
CREATE TABLE IF NOT EXISTS boks.boks_agent_traces (
  id TEXT PRIMARY KEY,
  family_id TEXT,
  conversation_id TEXT,
  trace_id TEXT NOT NULL,
  span_name TEXT NOT NULL,
  span_kind TEXT NOT NULL CHECK (span_kind IN ('router','planner','executor','synth','safety','tool')),
  tool_id TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('ok','error','intercepted','timeout')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_agent_traces_trace_idx ON boks.boks_agent_traces (trace_id, created_at);
ALTER TABLE boks.boks_agent_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_agent_traces FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS boks_agent_traces_owner ON boks.boks_agent_traces;
CREATE POLICY boks_agent_traces_owner ON boks.boks_agent_traces TO boks_owner USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS boks_agent_traces_readonly ON boks.boks_agent_traces;
CREATE POLICY boks_agent_traces_readonly ON boks.boks_agent_traces TO boks_readonly USING (true);

-- boks_idempotency_keys
CREATE TABLE IF NOT EXISTS boks.boks_idempotency_keys (
  key_hash TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  route TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS boks_idempotency_expires_idx ON boks.boks_idempotency_keys (expires_at);
ALTER TABLE boks.boks_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_idempotency_keys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS boks_idempotency_owner ON boks.boks_idempotency_keys;
CREATE POLICY boks_idempotency_owner ON boks.boks_idempotency_keys TO boks_owner USING (true) WITH CHECK (true);
GRANT INSERT, UPDATE, DELETE ON boks.boks_idempotency_keys TO boks_app;