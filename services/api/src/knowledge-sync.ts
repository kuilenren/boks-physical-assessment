import { createHash, randomUUID } from "node:crypto";
import {
  loadPlatformStore,
  updatePlatformStore,
  type KnowledgeSource,
  type KnowledgeVersion,
} from "./demo-store.js";

const SYNC_ACTOR = "system:knowledge-sync";

export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function fetchSourceContent(
  url: string,
  timeoutMs = 15000,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`抓取来源失败：HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function latestVersion(
  versions: Record<string, KnowledgeVersion>,
  sourceId: string,
): KnowledgeVersion | null {
  const items = Object.values(versions).filter(
    (item) => item.source_id === sourceId,
  );
  return (
    items.sort((left, right) =>
      (left.created_at ?? "").localeCompare(right.created_at ?? ""),
    )[items.length - 1] ?? null
  );
}

export async function syncKnowledgeSource(
  sourceId: string,
  fetcher: (url: string) => Promise<string> = fetchSourceContent,
): Promise<{
  source_id: string;
  status: "updated" | "unchanged" | "failed";
  reason?: string;
}> {
  const platform = await loadPlatformStore();
  const source = platform.knowledgeSources[sourceId];
  if (!source)
    return {
      source_id: sourceId,
      status: "failed",
      reason: "KNOWLEDGE_SOURCE_NOT_FOUND",
    };
  if (!source.fetch_url)
    return {
      source_id: sourceId,
      status: "failed",
      reason: "KNOWLEDGE_SOURCE_NO_URL",
    };
  let content: string;
  try {
    content = await fetcher(source.fetch_url);
  } catch (error) {
    return {
      source_id: sourceId,
      status: "failed",
      reason: error instanceof Error ? error.message : "FETCH_ERROR",
    };
  }
  const hash = contentHash(content);
  const current = latestVersion(platform.knowledgeVersions, sourceId);
  if (current && current.content_hash === hash)
    return { source_id: sourceId, status: "unchanged" };
  const item: KnowledgeVersion = {
    id: randomUUID(),
    source_id: sourceId,
    version: new Date().toISOString().slice(0, 10),
    title: source.title,
    content,
    content_hash: hash,
    status: "candidate",
    reviewers: [SYNC_ACTOR],
    published_at: null,
    created_at: new Date().toISOString(),
  };
  await updatePlatformStore((next) => {
    const target = next.knowledgeSources[sourceId];
    if (!target) return;
    target.content_hash = hash;
    next.knowledgeVersions[item.id] = item;
    next.auditEvents.push({
      id: randomUUID(),
      action: "knowledge.sync",
      actor: SYNC_ACTOR,
      created_at: new Date().toISOString(),
    });
  });
  return { source_id: sourceId, status: "updated" };
}

export async function syncAllKnowledgeSources(
  fetcher?: (url: string) => Promise<string>,
): Promise<Array<{ source_id: string; status: string; reason?: string }>> {
  const platform = await loadPlatformStore();
  const sourceIds = Object.values(platform.knowledgeSources)
    .filter((source: KnowledgeSource) => source.fetch_url)
    .map((source) => source.id);
  const results = [];
  for (const sourceId of sourceIds)
    results.push(await syncKnowledgeSource(sourceId, fetcher));
  return results;
}

export function startKnowledgeSyncScheduler(): void {
  const intervalMs = Number(process.env.BOKS_KNOWLEDGE_SYNC_INTERVAL_MS ?? 0);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;
  const timer = setInterval(() => {
    void syncAllKnowledgeSources().catch(() => {
      /* 调度器失败不中断进程，下次周期重试 */
    });
  }, intervalMs);
  timer.unref();
}
