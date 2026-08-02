-- migrations/0070_chat/0070_conversations.sql
-- 依赖：0010_families
-- 说明：AI 咨询会话
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_chat_conversations (
  id                  TEXT PRIMARY KEY,
  family_id           TEXT NOT NULL REFERENCES boks.boks_families(id) ON DELETE CASCADE,
  child_id            TEXT REFERENCES boks.boks_children(id) ON DELETE SET NULL,
  context_report_id   TEXT,
  context_plan_id     TEXT,
  title               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_chat_conversations_family_created_idx
  ON boks.boks_chat_conversations (family_id, created_at DESC);

ALTER TABLE boks.boks_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_chat_conversations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_chat_conversations_family ON boks.boks_chat_conversations;
CREATE POLICY boks_chat_conversations_family ON boks.boks_chat_conversations
  USING (family_id = current_setting('app.family_id', true))
  WITH CHECK (family_id = current_setting('app.family_id', true));

DROP POLICY IF EXISTS boks_chat_conversations_owner ON boks.boks_chat_conversations;
CREATE POLICY boks_chat_conversations_owner ON boks.boks_chat_conversations
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_chat_conversations TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_chat_conversations;