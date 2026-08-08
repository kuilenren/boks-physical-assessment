-- migrations/0130_ai/0131_prompt_versions.sql
-- 依赖：0001_extensions
-- 说明：Prompt 模板版本（双人审核激活）
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_prompt_versions (
  id              TEXT PRIMARY KEY,             -- "chat/parent_v1"
  family          TEXT NOT NULL,                -- chat / classify / rerank / summary / extract
  version         INTEGER NOT NULL,
  tone            TEXT NOT NULL,                -- calm_teacher / warm_companion / concise_official
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','canary','active','retired')),
  yaml_body       TEXT NOT NULL,
  change_note     TEXT NOT NULL,
  created_by      TEXT NOT NULL,
  reviewed_by     TEXT,
  approved_by     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at    TIMESTAMPTZ,
  UNIQUE (family, tone, version)
);

ALTER TABLE boks.boks_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_prompt_versions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_prompt_versions_owner ON boks.boks_prompt_versions;
CREATE POLICY boks_prompt_versions_owner ON boks.boks_prompt_versions
  TO boks_owner USING (true) WITH CHECK (true);

-- active 状态对外只读（给 AI 服务读）
DROP POLICY IF EXISTS boks_prompt_versions_active_read ON boks.boks_prompt_versions;
CREATE POLICY boks_prompt_versions_active_read ON boks.boks_prompt_versions
  USING (status IN ('active','canary'));

GRANT SELECT ON boks.boks_prompt_versions TO boks_app, boks_readonly;
GRANT INSERT, UPDATE, DELETE ON boks.boks_prompt_versions TO boks_owner;

-- DOWN
DROP TABLE IF EXISTS boks.boks_prompt_versions;