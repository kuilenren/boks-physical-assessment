import Taro from "@tarojs/taro";
import type { AssessmentMetricInput } from "../models";

const DRAFT_KEY_PREFIX = "boks.draft.";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface DraftState {
  sessionId: string;
  childId: string;
  values: AssessmentMetricInput[];
  updatedAt: string;
}

function getDraftKey(childId: string): string {
  return `${DRAFT_KEY_PREFIX}${childId}`;
}

export function getDraft(childId: string): DraftState | null {
  try {
    const raw = Taro.getStorageSync<string>(getDraftKey(childId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as DraftState;
    const updatedAt = new Date(draft.updatedAt).getTime();
    if (Date.now() - updatedAt > DRAFT_TTL_MS) {
      Taro.removeStorageSync(getDraftKey(childId));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: DraftState): void {
  Taro.setStorageSync(getDraftKey(draft.childId), JSON.stringify(draft));
}

export function clearDraft(childId: string): void {
  Taro.removeStorageSync(getDraftKey(childId));
}

export function clearAllDrafts(): void {
  const keys = Object.keys(Taro.getStorageInfoSync().keys ?? []);
  for (const key of keys) {
    if (key.startsWith(DRAFT_KEY_PREFIX)) {
      Taro.removeStorageSync(key);
    }
  }
}