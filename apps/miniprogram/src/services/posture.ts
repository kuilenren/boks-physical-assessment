import type {
  PostureSession as ContractPostureSession,
  PostureView as ContractPostureView,
} from "@boks/contracts";
import type { PostureSession } from "../models";
import { request } from "./http";

export function createPostureSession(childId: string, consentVersion: string) {
  return request<ContractPostureSession>("/posture/sessions", {
    method: "POST",
    data: {
      child_id: childId,
      consent_record_id: consentVersion,
      capture_protocol_version: "posture-capture-v1",
      required_views: ["front", "back", "left", "right"],
    },
  }).then(mapSession);
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
