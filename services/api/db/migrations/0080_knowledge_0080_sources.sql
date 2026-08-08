-- migrations/0080_knowledge/0080_sources.sql
-- 依赖：0001_extensions
-- 说明：知识库来源注册表（公开表，RLS = 公开读）
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_knowledge_sources (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  publisher       TEXT NOT NULL,
  url             TEXT NOT NULL,
  pdf_sha256      TEXT,
  doc_type        TEXT NOT NULL CHECK (doc_type IN ('law','standard','guide','research','expert_consensus')),
  language        TEXT NOT NULL DEFAULT 'zh-CN',
  retrieved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_from  DATE,
  effective_to    DATE,
  notes           TEXT
);

ALTER TABLE boks.boks_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_knowledge_sources FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_knowledge_sources_public_read ON boks.boks_knowledge_sources;
CREATE POLICY boks_knowledge_sources_public_read ON boks.boks_knowledge_sources
  USING (true);

DROP POLICY IF EXISTS boks_knowledge_sources_owner ON boks.boks_knowledge_sources;
CREATE POLICY boks_knowledge_sources_owner ON boks.boks_knowledge_sources
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT ON boks.boks_knowledge_sources TO boks_app, boks_readonly;
GRANT INSERT, UPDATE, DELETE ON boks.boks_knowledge_sources TO boks_owner;

-- DOWN
DROP TABLE IF EXISTS boks.boks_knowledge_sources;