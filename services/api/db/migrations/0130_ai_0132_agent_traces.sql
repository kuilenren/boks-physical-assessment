-- migrations/0130_ai/0132_agent_traces.sql
-- 依赖：0010_families
-- 说明：Agent 步骤级 trace（plan/exec/synth/safety）
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_agent_traces (
  id                  TEXT PRIMARY KEY,
  family_id           TEXT REFERENCES boks.boks_families(id) ON DELETE SET NULL,
  conversation_id     TEXT,
  trace_id            TEXT NOT NULL,
  span_name           TEXT NOT NULL,
  span_kind           TEXT NOT NULL CHECK (span_kind IN ('router','planner','executor','synth','safety','tool')),
  tool_id             TEXT,
  input_tokens        INTEGER NOT NULL DEFAULT 0,
  output_tokens       INTEGER NOT NULL DEFAULT 0,
  latency_ms          INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL CHECK (status IN ('ok','error','intercepted','timeout')),
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_agent_traces_trace_idx
  ON boks.boks_agent_traces (trace_id, created_at);
CREATE INDEX IF NOT EXISTS boks_agent_traces_family_idx
  ON boks.boks_agent_traces (family_id, created_at DESC);

ALTER TABLE boks.boks_agent_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_agent_traces FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_agent_traces_owner ON boks.boks_agent_traces;
CREATE POLICY boks_agent_traces_owner ON boks.boks_agent_traces
  TO boks_owner USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS boks_agent_traces_readonly ON boks.boks_agent_traces;
CREATE POLICY boks_agent_traces_readonly ON boks.boks_agent_traces
  TO boks_readonly USING (true);

GRANT SELECT ON boks.boks_agent_traces TO boks_readonly;

-- DOWN
DROP TABLE IF EXISTS boks.boks_agent_traces;