import { Button, Text, Textarea, View } from "@tarojs/components";
import { showToast, useLoad } from "@tarojs/taro";
import { useState } from "react";
import type { ChatMessage, ChildProfile } from "../../models";
import { createConversation, sendMessage } from "../../services/chat";
import { listChildren } from "../../services/family";
import { ChildPicker } from "../../components/ChildPicker";
import { IconBadge } from "../../components/Icon";
import { LoadingState } from "../../components/PageState";
import { showError } from "../../utils/error";
import {
  selectChild,
  setSelectedChildId,
} from "../../services/child-selection";

export default function ChatPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [childId, setChildId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useLoad(() => {
    void Promise.all([listChildren(), createConversation()])
      .then(([childItems, conversation]) => {
        setChildren(childItems);
        setChildId(selectChild(childItems));
        setConversationId(conversation.id);
      })
      .catch((error) => showError(error, "咨询服务加载失败。"))
      .finally(() => setLoading(false));
  });

  const send = async () => {
    const text = content.trim();
    if (!text || !conversationId) {
      void showToast({ title: "请输入想咨询的内容", icon: "none" });
      return;
    }
    setSending(true);
    try {
      const result = await sendMessage(conversationId, {
        content: text,
        child_id: childId || null,
      });
      setMessages((current) => [
        ...current,
        {
          id: `local-user-${Date.now()}`,
          role: "user",
          content: text,
          citations: [],
          created_at: new Date().toISOString(),
        },
        result.message,
      ]);
      setContent("");
    } catch (error) {
      showError(error, "发送咨询失败。");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View className="page">
        <LoadingState />
      </View>
    );
  }

  return (
    <View className="page">
      <View className="page-header">
        <Text className="page-kicker">GUIDED CONSULTING</Text>
        <Text className="page-title">专业咨询</Text>
        <Text className="page-subtitle">
          只回答 BOKS 体测、训练、体态观察和隐私流程；不提供诊断或处方。
        </Text>
      </View>

      <View className="danger-note">
        <IconBadge name="alert" tone="danger" size={28} />
        <Text>
          如有疼痛、麻木、无力、呼吸困难或其他急症，请停止训练并及时就医。
        </Text>
      </View>

      <View className="card">
        <View className="child-row" style={{ marginBottom: "8px" }}>
          <Text className="section-title" style={{ marginBottom: 0 }}>
            关联儿童
          </Text>
          <IconBadge name="chat" tone="sky" size={36} />
        </View>
        <ChildPicker
          children={children}
          value={childId}
          onChange={(nextChildId) => {
            setChildId(nextChildId);
            setSelectedChildId(nextChildId);
          }}
        />
      </View>

      <View className="card chat-list">
        {messages.length === 0 ? (
          <Text className="muted">
            可以问：如何看体测报告？如何安排训练？体态照片有哪些拍摄要求？
          </Text>
        ) : null}
        {messages.map((message) => (
          <View className={`chat-bubble chat-${message.role}`} key={message.id}>
            <Text>{message.content}</Text>
            {message.citations.length > 0 ? (
              <Text className="muted">
                依据：
                {message.citations
                  .map((item) => `${item.title}（${item.version}）`)
                  .join("、")}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      <Textarea
        className="chat-input"
        value={content}
        maxlength={2000}
        placeholder="请输入想咨询的问题"
        onInput={(event) => setContent(event.detail.value)}
      />
      <Button
        className="primary-button"
        loading={sending}
        onClick={() => void send()}
      >
        发送
      </Button>
    </View>
  );
}
