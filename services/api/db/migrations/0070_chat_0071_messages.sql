-- migrations/0070_chat/0071_messages.sql
-- 依赖：0070_conversations
-- 说明：AI 咨询消息（含引用与拦截标记）
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_chat_messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES boks.boks_chat_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT NOT NULL,
  citations       JSONB NOT NULL DEFAULT '[]'::jsonb,
  intercepted     BOOLEAN NOT NULL DEFAULT FALSE,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_chat_messages_conv_created_idx
  ON boks.boks_chat_messages (conversation_id, created_at);

-- 隔离策略：通过 conversation 间接检查 family（应用层 JOIN 校验）
ALTER TABLE boks.boks_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_chat_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_chat_messages_owner ON boks.boks_chat_messages;
CREATE POLICY boks_chat_messages_owner ON boks.boks_chat_messages
  TO boks_owner USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS boks_chat_messages_app_via_conv ON boks.boks_chat_messages;
CREATE POLICY boks_chat_messages_app_via_conv ON boks.boks_chat_messages
  TO boks_app USING (
    EXISTS (
      SELECT 1 FROM boks.boks_chat_conversations c
      WHERE c.id = conversation_id
        AND c.family_id = current_setting('app.family_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boks.boks_chat_conversations c
      WHERE c.id = conversation_id
        AND c.family_id = current_setting('app.family_id', true)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_chat_messages TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_chat_messages;