-- migrations/0090_standards/0091_indicators.sql
-- 依赖：0090_versions
-- 说明：评分指标定义
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_standard_indicators (
  standard_id     TEXT NOT NULL REFERENCES boks.boks_standard_versions(id) ON DELETE CASCADE,
  indicator_code  TEXT NOT NULL,
  label           TEXT NOT NULL,
  unit            TEXT NOT NULL,
  input_type      TEXT NOT NULL CHECK (input_type IN ('decimal','integer')),
  min_value       NUMERIC NOT NULL,
  max_value       NUMERIC NOT NULL,
  step            NUMERIC NOT NULL,
  required        BOOLEAN NOT NULL,
  help_text       TEXT NOT NULL,
  PRIMARY KEY (standard_id, indicator_code)
);

ALTER TABLE boks.boks_standard_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_standard_indicators FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_indicators_public_read ON boks.boks_standard_indicators;
CREATE POLICY boks_indicators_public_read ON boks.boks_standard_indicators
  USING (true);

DROP POLICY IF EXISTS boks_indicators_owner ON boks.boks_standard_indicators;
CREATE POLICY boks_indicators_owner ON boks.boks_standard_indicators
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT ON boks.boks_standard_indicators TO boks_app, boks_readonly;
GRANT INSERT, UPDATE, DELETE ON boks.boks_standard_indicators TO boks_owner;

-- DOWN
DROP TABLE IF EXISTS boks.boks_standard_indicators;