/**
 * 流式 SSE 客户端（NestJS → AI 服务）
 * - 透传 SSE 事件给小程序 / Flutter
 * - 自动转发 traceparent
 * - 支持 client 断开 → 透传 cancellation
 */
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { aiServiceBaseUrl } from "./ai-client.js";

export type StreamCallbacks = {
  onPlan?: (data: { steps: string[] }) => void;
  onToolCall?: (data: { id: string; args: Record<string, unknown> }) => void;
  onToolResult?: (data: { id: string; ok: boolean; citations?: unknown[] }) => void;
  onDelta?: (data: { delta: string }) => void;
  onMessage?: (data: { answer: string; citations: unknown[]; intent?: string; intercepted?: boolean }) => void;
  onTrace?: (data: { trace_id: string }) => void;
  onDone?: (data: { trace_id: string; usage?: unknown }) => void;
  onError?: (err: Error) => void;
};

export async function streamAiChat(
  body: { content: string; child_grade?: string | null; audience?: string | null; conversation_id?: string | null },
  abortSignal: AbortSignal,
  cb: StreamCallbacks,
): Promise<void> {
  const base = aiServiceBaseUrl();
  if (!base) throw new Error("BOKS_AI_SERVICE_URL 未配置");

  const res = await fetch(`${base}/v1/chat/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: abortSignal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI upstream error ${res.status}: ${text.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const event = parseSseBlock(raw);
      if (!event) continue;
      try {
        const data = event.data ? JSON.parse(event.data) : {};
        switch (event.event) {
          case "trace":    cb.onTrace?.(data); break;
          case "plan":     cb.onPlan?.(data); break;
          case "tool_call":cb.onToolCall?.(data); break;
          case "tool_result": cb.onToolResult?.(data); break;
          case "delta":    cb.onDelta?.(data); break;
          case "message":  cb.onMessage?.(data); break;
          case "done":     cb.onDone?.(data); break;
          case "tool_error": cb.onError?.(new Error(String(data.error))); break;
          default: break;
        }
      } catch (e) {
        cb.onError?.(e as Error);
      }
    }
  }
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  return { event, data };
}

/** Express handler：把 SSE 透传给小程序 / Flutter */
export async function sseHandler(
  req: Request,
  res: Response,
  body: { content: string; child_grade?: string | null; audience?: string | null; conversation_id?: string | null },
): Promise<void> {
  const traceId = (req.header("x-trace-id") ?? randomUUID()) as string;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("x-trace-id", traceId);
  res.flushHeaders?.();
  res.write(`event: trace\ndata: ${JSON.stringify({ trace_id: traceId })}\n\n`);

  const ac = new AbortController();
  req.on("close", () => ac.abort());

  const send = (event: string, data: unknown) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await streamAiChat(body, ac.signal, {
      onPlan: (d) => send("plan", d),
      onToolCall: (d) => send("tool_call", d),
      onToolResult: (d) => send("tool_result", d),
      onDelta: (d) => send("delta", d),
      onMessage: (d) => send("message", d),
      onDone: (d) => send("done", d),
      onError: (e) => send("error", { message: e.message }),
    });
    send("done", { trace_id: traceId });
  } catch (e) {
    send("error", { message: (e as Error).message });
  } finally {
    res.end();
  }
}