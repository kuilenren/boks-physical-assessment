import type { ChatCitation } from "@boks/contracts";

export type AiKnowledgeDocument = {
  source_id: string;
  version: string;
  title: string;
  content: string;
};

export type AiChatResult = {
  content: string;
  citations: ChatCitation[];
  intent: string;
  intercepted: boolean;
};

const DEFAULT_TIMEOUT_MS = 12000;

export function aiServiceBaseUrl(): string | undefined {
  const url = process.env.BOKS_AI_SERVICE_URL;
  return url && url.trim().length > 0
    ? url.trim().replace(/\/+$/, "")
    : undefined;
}

export async function requestAiChat(
  content: string,
  documents: AiKnowledgeDocument[],
  childGrade?: string | null,
): Promise<AiChatResult | null> {
  const baseUrl = aiServiceBaseUrl();
  if (!baseUrl) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/v1/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        content,
        documents,
        child_grade: childGrade ?? null,
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as AiChatResult;
    if (!payload || typeof payload.content !== "string") return null;
    return {
      content: payload.content,
      citations: Array.isArray(payload.citations)
        ? payload.citations.map((item) => ({
            source_id: String(item.source_id ?? ""),
            title: String(item.title ?? ""),
            version: String(item.version ?? ""),
          }))
        : [],
      intent: String(payload.intent ?? "process"),
      intercepted: Boolean(payload.intercepted),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
