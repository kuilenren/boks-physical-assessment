-- migrations/0080_knowledge/0081_versions.sql
-- 依赖：0080_sources
-- 说明：知识库版本（草稿/审核中/已发布/已撤回）
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_knowledge_versions (
  id              TEXT PRIMARY KEY,
  source_id       TEXT NOT NULL REFERENCES boks.boks_knowledge_sources(id) ON DELETE CASCADE,
  version         TEXT NOT NULL,
  title           TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'guide'
                  CHECK (category IN ('policy','standard','guide','action','case','faq')),
  audience        TEXT[] NOT NULL DEFAULT ARRAY['parent']::TEXT[],
  language        TEXT NOT NULL DEFAULT 'zh-CN',
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','in_review','published','retired')),
  content_hash    TEXT NOT NULL,
  content         TEXT NOT NULL,
  reviewers       JSONB NOT NULL DEFAULT '[]'::jsonb,
  approvers       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at    TIMESTAMPTZ,
  effective_from  DATE,
  effective_to    DATE,
  UNIQUE (source_id, version)
);
CREATE INDEX IF NOT EXISTS boks_knowledge_versions_published_idx
  ON boks.boks_knowledge_versions (status, published_at DESC)
  WHERE status = 'published';

ALTER TABLE boks.boks_knowledge_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_knowledge_versions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_knowledge_versions_public_read ON boks.boks_knowledge_versions;
CREATE POLICY boks_knowledge_versions_public_read ON boks.boks_knowledge_versions
  USING (status = 'published');

DROP POLICY IF EXISTS boks_knowledge_versions_owner ON boks.boks_knowledge_versions;
CREATE POLICY boks_knowledge_versions_owner ON boks.boks_knowledge_versions
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT ON boks.boks_knowledge_versions TO boks_app, boks_readonly;
GRANT INSERT, UPDATE, DELETE ON boks.boks_knowledge_versions TO boks_owner;

-- DOWN
DROP TABLE IF EXISTS boks.boks_knowledge_versions;