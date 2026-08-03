import type { Child } from "@boks/contracts";
import type {
  ChildProfile,
  Consent,
  DataExport,
  DeletionRequest,
  FamilySummary,
} from "../models";
import { request } from "./http";

export function getFamilySummary() {
  return request<{ id: string; display_name: string; children: Child[] }>(
    "/families/me",
  ).then((family) => ({
    family_id: family.id,
    display_name: family.display_name,
    children: family.children?.map(mapChild) ?? [],
    pending_actions: 0,
  }));
}

export function listChildren() {
  return request<Child[]>("/families/me/children").then((items) =>
    (items ?? []).map(mapChild),
  );
}

export function createChild(data: {
  display_name: string;
  birth_date: string;
  sex: ChildProfile["sex"];
}) {
  return request<Child>("/families/me/children", {
    method: "POST",
    data: {
      display_name: data.display_name,
      birth_date: data.birth_date,
      sex_code: data.sex === "unknown" ? "unspecified" : data.sex,
      school_stage: "primary",
      grade_code: "unassigned",
    },
  }).then(mapChild);
}

export function recordConsent(data: {
  child_id: string;
  purpose: Consent["purpose"];
  version: string;
}) {
  return request<Consent>("/families/me/consents", {
    method: "POST",
    data: { ...data, granted: true },
  });
}

export function listConsents() {
  return request<Consent[]>("/families/me/consents");
}

export function withdrawConsent(consentId: string) {
  return request<Consent>(
    `/consents/${encodeURIComponent(consentId)}/withdraw`,
    {
      method: "POST",
    },
  );
}

export function exportFamily() {
  return request<DataExport>("/families/me/export");
}

export function requestChildDeletion(childId: string) {
  return request<DeletionRequest>(
    `/children/${encodeURIComponent(childId)}/deletion-request`,
    { method: "POST" },
  );
}

export function deleteChild(childId: string) {
  return request<{ id: string; status: "deleted" }>(
    `/children/${encodeURIComponent(childId)}`,
    { method: "DELETE" },
  );
}

function mapChild(child: Child): ChildProfile {
  return {
    child_id: child.id,
    display_name: child.display_name,
    birth_date: child.birth_date,
    sex: child.sex_code === "unspecified" ? "unknown" : child.sex_code,
    grade_stage: `${child.school_stage} · ${child.grade_code}`,
    status: child.profile_status,
  };
}
