/**
 * 版本管理主入口
 * - getCurrentVersion(channel, client)
 * - compareVersions(a, b) → -1 / 0 / 1
 * - isCompatible(client, server) → boolean
 * - supportsHotUpdate(client) → boolean
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const META = JSON.parse(readFileSync(path.join(ROOT, "packages/version/meta.json"), "utf8"));

export type Channel = "stable" | "beta" | "canary";
export type Client = "miniprogram" | "mobile" | "admin" | "api" | "ai";

export function getCurrentVersion(channel: Channel, client: Client): string {
  return META.channels[channel][client];
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai !== bi) return ai < bi ? -1 : 1;
  }
  return 0;
}

function parseVersion(v: string): number[] {
  const main = v.split("-")[0];
  return main.split(".").map((s) => parseInt(s, 10));
}

export function isCompatible(clientVersion: string, serverVersion: string): boolean {
  return compareVersions(clientVersion, serverVersion) >= 0;
}

export function supportsHotUpdate(clientVersion: string): boolean {
  return compareVersions(clientVersion, META.hot_update.min_native_version) >= 0;
}

export function getReleaseNotes(version: string): string[] {
  return META.release_notes[version] ?? [];
}

export function getHotUpdateUrl(): string {
  return META.hot_update.delivery;
}

export function getRollbackUrl(): string {
  return META.hot_update.rollback_url;
}

export function getChannel(): Channel {
  return (process.env.BOKS_RELEASE_CHANNEL as Channel) ?? "stable";
}