import { getStorageSync, setStorageSync } from "@tarojs/taro";
import type { ChildProfile } from "../models";

const SELECTED_CHILD_KEY = "boks.selected-child-id";

export function getSelectedChildId(): string {
  const value = getStorageSync(SELECTED_CHILD_KEY);
  return typeof value === "string" ? value : "";
}

export function selectChild(
  children: ChildProfile[],
  preferredChildId?: string,
): string {
  const candidate = preferredChildId || getSelectedChildId();
  const selected =
    children.find((child) => child.child_id === candidate)?.child_id ??
    children[0]?.child_id ??
    "";
  if (selected) setStorageSync(SELECTED_CHILD_KEY, selected);
  return selected;
}

export function setSelectedChildId(childId: string): void {
  if (childId) setStorageSync(SELECTED_CHILD_KEY, childId);
}
