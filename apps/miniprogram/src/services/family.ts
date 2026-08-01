import type { Child } from "@boks/contracts";
import type { ChildProfile, FamilySummary } from "../models";
import { request } from "./http";

export function getFamilySummary() {
  return request<{ id: string; display_name: string; children: Child[] }>(
    "/families/me",
  ).then((family) => ({
    family_id: family.id,
    display_name: family.display_name,
    children: family.children.map(mapChild),
    pending_actions: 0,
  }));
}

export function listChildren() {
  return request<Child[]>("/families/me/children").then((items) =>
    items.map(mapChild),
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
