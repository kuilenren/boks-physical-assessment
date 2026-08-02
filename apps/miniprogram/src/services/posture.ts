import type {
  PostureSession as ContractPostureSession,
  PostureView as ContractPostureView,
} from "@boks/contracts";
import Taro from "@tarojs/taro";
import type { PostureSession } from "../models";
import type { PostureReport } from "../models";
import { request } from "./http";
import { recordConsent } from "./family";

export async function createPostureSession(
  childId: string,
  consentVersion: string,
) {
  const consent = await recordConsent({
    child_id: childId,
    purpose: "photo",
    version: consentVersion,
  });
  const session = await request<ContractPostureSession>("/posture/sessions", {
    method: "POST",
    data: {
      child_id: childId,
      consent_record_id: consent.id,
      capture_protocol_version: "posture-capture-v1",
      required_views: ["front", "back", "left", "right"],
    },
  });
  return mapSession(session);
}

export function attachPostureView(
  sessionId: string,
  view: ContractPostureView,
  assetId: string,
) {
  return request<ContractPostureSession>(
    `/posture/sessions/${sessionId}/views/${view}/attach`,
    {
      method: "POST",
      data: { asset_id: assetId },
    },
  ).then(mapSession);
}

export async function uploadPostureView(
  sessionId: string,
  view: ContractPostureView,
  filePath: string,
) {
  const [contentBase64, fileInfoResult] = await Promise.all([
    readFileAsBase64(filePath),
    Taro.getFileInfo({ filePath }),
  ]);
  if (!("size" in fileInfoResult)) throw new Error("照片大小读取失败。");
  return request<ContractPostureSession>(
    `/posture/sessions/${sessionId}/views/${view}/upload`,
    {
      method: "POST",
      data: {
        file_name: filePath.split("/").pop() ?? `${view}.jpg`,
        mime_type: "image/jpeg",
        size_bytes: fileInfoResult.size,
        content_base64: contentBase64,
      },
    },
  ).then(mapSession);
}

export function submitPostureSession(sessionId: string) {
  return request<ContractPostureSession>(
    `/posture/sessions/${sessionId}/submit`,
    {
      method: "POST",
    },
  ).then(mapSession);
}

export function getPostureSession(sessionId: string) {
  return request<ContractPostureSession>(`/posture/sessions/${sessionId}`).then(
    mapSession,
  );
}

export function getPostureReport(reportId: string) {
  return request<PostureReport>(
    `/posture/reports/${encodeURIComponent(reportId)}`,
  );
}

export function listPostureReports(childId: string) {
  return request<PostureReport[]>(
    `/posture/reports?child_id=${encodeURIComponent(childId)}`,
  );
}

function mapSession(session: ContractPostureSession): PostureSession {
  return {
    session_id: session.id,
    child_id: session.child_id,
    status: session.status,
    required_views: session.required_views,
    views: session.required_views.map((view) => ({
      view,
      asset_id: session.attached_views.includes(view)
        ? `registered-${view}`
        : undefined,
    })),
    quality_status:
      session.quality.overall === "passed"
        ? "ready_for_review"
        : session.quality.overall === "needs_retake"
          ? "needs_retake"
          : "pending",
    analysis: session.analysis,
    limitations: session.limitations,
  };
}

function readFileAsBase64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      encoding: "base64",
      success: (result) => {
        if (typeof result.data !== "string") {
          reject(new Error("照片读取失败。"));
          return;
        }
        resolve(result.data);
      },
      fail: reject,
    });
  });
}
