import Taro from "@tarojs/taro";
import type { ChildProfile } from "../models";

const FAMILY_CACHE_KEY = "boks.family.cache";
const FAMILY_TIMESTAMP_KEY = "boks.family.cache-time";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface FamilyCache {
  children: ChildProfile[];
  familyId: string;
  cachedAt: string;
}

export function getFamilyCache(): FamilyCache | null {
  try {
    const raw = Taro.getStorageSync<string>(FAMILY_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as FamilyCache;
    const storedTime = Taro.getStorageSync<number>(FAMILY_TIMESTAMP_KEY) ?? 0;
    if (Date.now() - storedTime > CACHE_TTL_MS) {
      Taro.removeStorageSync(FAMILY_CACHE_KEY);
      Taro.removeStorageSync(FAMILY_TIMESTAMP_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

export function setFamilyCache(cache: FamilyCache): void {
  Taro.setStorageSync(FAMILY_CACHE_KEY, JSON.stringify(cache));
  Taro.setStorageSync(FAMILY_TIMESTAMP_KEY, Date.now());
}

export function invalidateFamilyCache(): void {
  Taro.removeStorageSync(FAMILY_CACHE_KEY);
  Taro.removeStorageSync(FAMILY_TIMESTAMP_KEY);
}

export function getCachedChildren(): ChildProfile[] {
  return getFamilyCache()?.children ?? [];
}
