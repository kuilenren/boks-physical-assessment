import type { ChatConversation, ChatMessage } from "../models";
import { request } from "./http";

export function createConversation() {
  return request<ChatConversation>("/chat/conversations", {
    method: "POST",
  });
}

export function getConversation(conversationId: string) {
  return request<ChatConversation>(
    `/chat/conversations/${encodeURIComponent(conversationId)}`,
  );
}

export function sendMessage(
  conversationId: string,
  input: {
    content: string;
    child_id?: string | null;
    context_report_id?: string | null;
    context_plan_id?: string | null;
  },
) {
  return request<{ message: ChatMessage; conversation_id: string }>(
    `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      data: {
        content: input.content,
        child_id: input.child_id ?? null,
        context_report_id: input.context_report_id ?? null,
        context_plan_id: input.context_plan_id ?? null,
      },
    },
  );
}
