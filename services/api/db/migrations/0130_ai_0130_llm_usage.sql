-- migrations/0130_ai/0130_llm_usage.sql
-- 依赖：0010_families
-- 说明：LLM 用量与成本
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_llm_usage (
  id                  TEXT PRIMARY KEY,
  family_id           TEXT REFERENCES boks.boks_families(id) ON DELETE SET NULL,
  conversation_id     TEXT,
  model               TEXT NOT NULL,
  task                TEXT NOT NULL CHECK (task IN ('chat','classify','rerank','summary','extract','embed')),
  prompt_tokens       INTEGER NOT NULL DEFAULT 0,
  completion_tokens   INTEGER NOT NULL DEFAULT 0,
  cost_cny            NUMERIC(10,6) NOT NULL DEFAULT 0,
  latency_ms          INTEGER,
  trace_id            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_llm_usage_family_day_idx
  ON boks.boks_llm_usage (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS boks_llm_usage_model_idx
  ON boks.boks_llm_usage (model, created_at DESC);

ALTER TABLE boks.boks_llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_llm_usage FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_llm_usage_owner ON boks.boks_llm_usage;
CREATE POLICY boks_llm_usage_owner ON boks.boks_llm_usage
  TO boks_owner USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS boks_llm_usage_readonly ON boks.boks_llm_usage;
CREATE POLICY boks_llm_usage_readonly ON boks.boks_llm_usage
  TO boks_readonly USING (true);

GRANT SELECT ON boks.boks_llm_usage TO boks_readonly;

-- DOWN
DROP TABLE IF EXISTS boks.boks_llm_usage;