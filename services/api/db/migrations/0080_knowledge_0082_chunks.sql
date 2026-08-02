-- migrations/0080_knowledge/0082_chunks.sql
-- 依赖：0081_versions
-- 说明：知识库切片 + pgvector embedding（维度 768，与 BGE-M3 一致）
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_knowledge_chunks (
  id              TEXT PRIMARY KEY,
  version_id      TEXT NOT NULL REFERENCES boks.boks_knowledge_versions(id) ON DELETE CASCADE,
  ordinal         INTEGER NOT NULL,
  section         TEXT,
  content         TEXT NOT NULL,
  token_count     INTEGER NOT NULL,
  embedding       vector(768),
  bm25_terms      JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (version_id, ordinal)
);

-- 向量索引（IVFFlat，lists=100；预生产可调）
CREATE INDEX IF NOT EXISTS boks_chunks_embedding_idx
  ON boks.boks_knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- bm25 词频索引
CREATE INDEX IF NOT EXISTS boks_chunks_bm25_idx
  ON boks.boks_knowledge_chunks USING GIN (bm25_terms);

ALTER TABLE boks.boks_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_knowledge_chunks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_chunks_public_read ON boks.boks_knowledge_chunks;
CREATE POLICY boks_chunks_public_read ON boks.boks_knowledge_chunks
  USING (
    EXISTS (
      SELECT 1 FROM boks.boks_knowledge_versions v
      WHERE v.id = version_id AND v.status = 'published'
    )
  );

DROP POLICY IF EXISTS boks_chunks_owner ON boks.boks_knowledge_chunks;
CREATE POLICY boks_chunks_owner ON boks.boks_knowledge_chunks
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT ON boks.boks_knowledge_chunks TO boks_app, boks_readonly;
GRANT INSERT, UPDATE, DELETE ON boks.boks_knowledge_chunks TO boks_owner;

-- DOWN
DROP TABLE IF EXISTS boks.boks_knowledge_chunks;