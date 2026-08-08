-- migrations/0090_standards/0092_score_bands.sql
-- 依赖：0091_indicators
-- 说明：评分档位表（按指标分性别）
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_standard_score_bands (
  standard_id     TEXT NOT NULL,
  indicator_code  TEXT NOT NULL,
  sex_code        TEXT NOT NULL CHECK (sex_code IN ('female','male')),
  grade_code      TEXT NOT NULL,
  band_index      INTEGER NOT NULL,
  min_value       NUMERIC,
  max_value       NUMERIC,
  score           NUMERIC NOT NULL CHECK (score >= 0 AND score <= 100),
  PRIMARY KEY (standard_id, indicator_code, sex_code, grade_code, band_index),
  FOREIGN KEY (standard_id, indicator_code)
    REFERENCES boks.boks_standard_indicators(standard_id, indicator_code)
);
CREATE INDEX IF NOT EXISTS boks_score_bands_lookup_idx
  ON boks.boks_standard_score_bands (standard_id, indicator_code, sex_code, grade_code);

ALTER TABLE boks.boks_standard_score_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_standard_score_bands FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_score_bands_public_read ON boks.boks_standard_score_bands;
CREATE POLICY boks_score_bands_public_read ON boks.boks_standard_score_bands
  USING (true);

DROP POLICY IF EXISTS boks_score_bands_owner ON boks.boks_standard_score_bands;
CREATE POLICY boks_score_bands_owner ON boks.boks_standard_score_bands
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT ON boks.boks_standard_score_bands TO boks_app, boks_readonly;
GRANT INSERT, UPDATE, DELETE ON boks.boks_standard_score_bands TO boks_owner;

-- DOWN
DROP TABLE IF EXISTS boks.boks_standard_score_bands;