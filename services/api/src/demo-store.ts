import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import type {
  AssessmentReport,
  AssessmentSchema,
  AssessmentSessionStatus,
  AssessmentValue,
  Child,
  PostureSession,
  PostureView,
  ScoreResult,
  TrainingPlan,
  EngineResult as ContractEngineResult,
} from "@boks/contracts";
import { ForbiddenException } from "@nestjs/common";
import { isProductionRuntime } from "./runtime-config.js";
import {
  NATIONAL_2014_STANDARD_ID,
  NATIONAL_2014_STANDARD_NAME,
  NATIONAL_2014_ALGORITHM_VERSION,
  NATIONAL_2014_SOURCE_URL,
  gradeOf,
  national2014Indicators,
  scoreNational2014,
} from "./scoring-engine.js";
import {
  initializePostgresStore,
  isPostgresStorage,
  readFamilyDocument,
  readPlatformDocument,
  persistDocument,
  updatePlatformDocument,
  updateFamilyDocument,
  type StoreDocument,
} from "./storage.js";

export const DEMO_STANDARD_VERSION = NATIONAL_2014_STANDARD_ID;
export const DEMO_STANDARD_NAME = NATIONAL_2014_STANDARD_NAME;
export const DEMO_KNOWLEDGE_SNAPSHOT = "knowledge-demo-pending-review-v0";
export const ALGORITHM_VERSION = NATIONAL_2014_ALGORITHM_VERSION;

export type ScoreBand = {
  min: number | null;
  max: number | null;
  score: number;
};
export type AssessmentRule = {
  indicator_code: string;
  score_type: "higher_is_better" | "lower_is_better";
  baseline: number;
  points_per_unit: number;
  weight: number;
  score_bands?: ScoreBand[];
};
export type StandardConfiguration = {
  id: string;
  name: string;
  status: "approved" | "demo_pending_review";
  mode: "scored" | "reference_only";
  indicators: AssessmentSchema["indicators"];
  rules: AssessmentRule[];
  source_references: Array<{ title: string; official_url: string }>;
  reviewers: string[];
};
export type StoreConfiguration = {
  active_standard_id: string;
  algorithm_version: string;
  knowledge_snapshot_id: string;
  standards: StandardConfiguration[];
  candidates: StandardConfiguration[];
  history: StandardConfiguration[];
};
export type GuardianSession = {
  token: string;
  refresh_token: string;
  guardian_id: string;
  family_id: string;
  account_id?: string | null;
  role?: string | null;
  org_id?: string | null;
  created_at: string;
  expires_at: string;
  refresh_expires_at: string;
  revoked_at: string | null;
};
export type Account = {
  id: string;
  org_id: string | null;
  role: "super_admin" | "staff" | "parent";
  display_name: string;
  username: string | null;
  password_hash: string | null;
  phone: string | null;
  status: "active" | "disabled";
  family_id: string | null;
  created_by: string | null;
  created_at: string;
};
export type Organization = {
  id: string;
  name: string;
  status: "active" | "archived";
  created_at: string;
};
export type IdentityBinding = {
  provider: "wechat" | "password" | "phone";
  subject: string;
  guardian_id: string;
  family_id: string;
  account_id?: string | null;
  created_at: string;
};
export type Consent = {
  id: string;
  family_id: string;
  child_id: string;
  purpose: "privacy" | "assessment" | "photo" | "voice";
  version: string;
  granted: boolean;
  granted_at: string;
  withdrawn_at: string | null;
};
export type TrainingCheckIn = {
  id: string;
  plan_id: string;
  child_id: string;
  day: number;
  status: "completed" | "skipped";
  note: string | null;
  created_at: string;
};
export type PostureAsset = {
  id: string;
  session_id: string;
  view: PostureView;
  metadata: {
    mime_type: string;
    size_bytes: number;
    captured_at: string;
    storage_status?: "pending_upload" | "uploaded" | "legacy_unverified";
    storage_key?: string;
    checksum_sha256?: string;
    width_px?: number;
    height_px?: number;
    quality_status?: "passed" | "needs_retake";
    quality_score?: number;
    quality_reasons?: string[];
  };
};
export type PostureReport = {
  id: string;
  report_type: "posture";
  child_id: string;
  session_id: string;
  risk_level: "not_scored";
  observation_status: "insufficient_data" | "observed";
  confidence: "low" | "medium" | "high";
  observations: string[];
  recommendations: string[];
  limitations: string[];
  generated_at: string;
};
export type ChatCitation = {
  source_id: string;
  title: string;
  version: string;
};
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ChatCitation[];
  created_at: string;
};
export type ChatConversation = {
  id: string;
  family_id: string;
  child_id: string | null;
  context_report_id: string | null;
  context_plan_id: string | null;
  messages: ChatMessage[];
  created_at: string;
};
export type KnowledgeVersion = {
  id: string;
  source_id: string;
  version: string;
  title: string;
  content: string;
  content_hash: string | null;
  status: "candidate" | "published" | "withdrawn";
  reviewers: string[];
  published_at: string | null;
  created_at: string;
};
export type KnowledgeSource = {
  id: string;
  title: string;
  owner: string;
  fetch_url: string | null;
  content_hash: string | null;
  created_at: string;
};
export type AuditEvent = {
  id: string;
  action: string;
  actor: string;
  created_at: string;
};
export type FamilyRecord = {
  id: string;
  display_name: string;
  status: "active" | "archived" | "deleted";
};
export type DeletionRequest = {
  id: string;
  family_id: string;
  child_id: string;
  status: "requested" | "completed";
  created_at: string;
  completed_at?: string | null;
  deleted_asset_count?: number;
  proof_hash?: string | null;
};
export type AssessmentSession = {
  id: string;
  child_id: string;
  measurement_date: string;
  standard_version_id: string;
  status: AssessmentSessionStatus;
  test_status: "completed" | "makeup" | "exempt" | "deferred";
  values: AssessmentValue[];
  report_id: string | null;
};
export type BoksStore = {
  family_id: string;
  families: Record<string, FamilyRecord>;
  organizations: Record<string, Organization>;
  accounts: Record<string, Account>;
  children: Child[];
  assessmentSessions: Record<string, AssessmentSession>;
  reports: Record<string, AssessmentReport>;
  trainingPlans: Record<string, TrainingPlan>;
  postureSessions: Record<string, PostureSession>;
  postureAssets: Record<string, PostureAsset>;
  postureReports: Record<string, PostureReport>;
  sessions: Record<string, GuardianSession>;
  identityBindings: Record<string, IdentityBinding>;
  consents: Record<string, Consent>;
  checkIns: Record<string, TrainingCheckIn>;
  conversations: Record<string, ChatConversation>;
  knowledgeSources: Record<string, KnowledgeSource>;
  knowledgeVersions: Record<string, KnowledgeVersion>;
  auditEvents: AuditEvent[];
  deletionRequests: DeletionRequest[];
  configuration: StoreConfiguration;
};
export type PlatformStore = Pick<
  BoksStore,
  "configuration" | "knowledgeSources" | "knowledgeVersions" | "auditEvents"
>;

const filePath =
  process.env.BOKS_DATA_FILE ?? join(process.cwd(), "data", "boks-store.json");
const iso = () => new Date().toISOString();
const today = new Date().toISOString().slice(0, 10);
function ageInMonths(birthDate: string, measurementDate = today): number {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const measurement = new Date(`${measurementDate}T00:00:00Z`);
  let months =
    (measurement.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    measurement.getUTCMonth() -
    birth.getUTCMonth();
  if (measurement.getUTCDate() < birth.getUTCDate()) months -= 1;
  return Math.max(0, months);
}
export function buildChild(
  input: Omit<Child, "id" | "age_in_months" | "profile_status" | "family_id">,
  familyId = store.family_id,
): Child {
  return {
    ...input,
    id: randomUUID(),
    family_id: familyId,
    age_in_months: ageInMonths(input.birth_date),
    profile_status: "active",
  };
}

const nationalIndicators = national2014Indicators(6);
const preschoolIndicators = [
  {
    indicator_code: "balance_single_leg",
    label: "单脚站立",
    unit: "秒",
    input_type: "decimal" as const,
    min_value: 0,
    max_value: 120,
    step: 0.1,
    required: true,
    help_text: "记录最长稳定时间。",
  },
  {
    indicator_code: "jump_forward",
    label: "立定跳远",
    unit: "厘米",
    input_type: "decimal" as const,
    min_value: 0,
    max_value: 300,
    step: 0.1,
    required: true,
    help_text: "记录脚后跟最近落点。",
  },
];
const standard = (
  id: string,
  name: string,
  mode: "scored" | "reference_only",
  list: typeof nationalIndicators,
  status: "approved" | "demo_pending_review" = "demo_pending_review",
): StandardConfiguration => ({
  id,
  name,
  status,
  mode,
  indicators: list,
  rules: [
    {
      indicator_code: "run_50m",
      score_type: "lower_is_better" as const,
      baseline: 12.5,
      points_per_unit: 13.3333,
      weight: 0.35,
    },
    {
      indicator_code: "sit_reach",
      score_type: "higher_is_better" as const,
      baseline: 5,
      points_per_unit: 2.6667,
      weight: 0.25,
    },
    {
      indicator_code: "rope_1min",
      score_type: "higher_is_better" as const,
      baseline: 50,
      points_per_unit: 0.8,
      weight: 0.4,
    },
  ].filter((rule) =>
    list.some((item) => item.indicator_code === rule.indicator_code),
  ),
  source_references: [
    {
      title: "国家学生体质健康标准（2014年修订）",
      official_url: NATIONAL_2014_SOURCE_URL,
    },
  ],
  reviewers: [],
});
const defaultConfiguration: StoreConfiguration = {
  active_standard_id: DEMO_STANDARD_VERSION,
  algorithm_version: ALGORITHM_VERSION,
  knowledge_snapshot_id: DEMO_KNOWLEDGE_SNAPSHOT,
  standards: [
    standard(
      DEMO_STANDARD_VERSION,
      DEMO_STANDARD_NAME,
      "scored",
      nationalIndicators,
      "approved",
    ),
    standard(
      "ref-demo-preschool-development-v0",
      "幼儿体能发展目标参考·开发夹具",
      "reference_only",
      preschoolIndicators,
    ),
  ],
  candidates: [],
  history: [],
};
const demoChild: Child = {
  id: "child-demo-001",
  family_id: "family-demo-001",
  display_name: "小朋友",
  birth_date: "2018-04-12",
  age_in_months: ageInMonths("2018-04-12"),
  sex_code: "female",
  school_stage: "primary",
  grade_code: "grade_2",
  profile_status: "active",
};
function emptyStore(): BoksStore {
  return {
    family_id: "family-demo-001",
    families: {
      "family-demo-001": {
        id: "family-demo-001",
        display_name: "BOKS 演示家庭",
        status: "active",
      },
    },
    organizations: {},
    accounts: {},
    children: [structuredClone(demoChild)],
    assessmentSessions: {},
    reports: {},
    trainingPlans: {},
    postureSessions: {},
    postureAssets: {},
    postureReports: {},
    sessions: {},
    identityBindings: {},
    consents: {},
    checkIns: {},
    conversations: {},
    knowledgeSources: {},
    knowledgeVersions: {},
    auditEvents: [],
    deletionRequests: [],
    configuration: structuredClone(defaultConfiguration),
  };
}
function mergeStore(loaded: Partial<BoksStore>): BoksStore {
  const fallback = emptyStore();
  const familyId = loaded.family_id ?? fallback.family_id;
  return {
    ...fallback,
    ...loaded,
    families: {
      ...fallback.families,
      ...(loaded.families ?? {}),
      [familyId]: {
        ...fallback.families[fallback.family_id],
        ...(loaded.families?.[familyId] ?? {}),
        id: familyId,
      },
    },
    children: (loaded.children ?? fallback.children).map((child) => ({
      ...child,
      family_id: child.family_id ?? familyId,
    })),
    configuration: {
      ...defaultConfiguration,
      ...(loaded.configuration ?? {}),
    },
  };
}
function loadStore(): BoksStore {
  try {
    if (existsSync(filePath)) {
      const loaded = JSON.parse(
        readFileSync(filePath, "utf8"),
      ) as Partial<BoksStore>;
      return mergeStore(loaded);
    }
  } catch {
    // A corrupt local demo file is replaced with a safe seed.
  }
  const seeded = emptyStore();
  if (!isPostgresStorage()) persistStore(seeded);
  return seeded;
}
export let store: BoksStore = loadStore();
export const children = store.children;
export const postureReports = store.postureReports;
export const assessmentSessions = new Map<string, AssessmentSession>();
export const reports = new Map<string, AssessmentReport>();
export const trainingPlans = new Map<string, TrainingPlan>();
export const postureSessions = new Map<string, PostureSession>();
export const postureAssets = new Map<string, string>();
for (const [id, value] of Object.entries(store.assessmentSessions))
  assessmentSessions.set(id, value);
for (const [id, value] of Object.entries(store.reports)) reports.set(id, value);
for (const [id, value] of Object.entries(store.trainingPlans))
  trainingPlans.set(id, value);
for (const [id, value] of Object.entries(store.postureSessions))
  postureSessions.set(id, value);
for (const [id, value] of Object.entries(store.postureAssets))
  postureAssets.set(id, value.view);
function syncCollections(): void {
  store.children = children;
  store.postureReports = postureReports;
  assessmentSessions.clear();
  reports.clear();
  trainingPlans.clear();
  postureSessions.clear();
  postureAssets.clear();
  for (const [id, value] of Object.entries(store.assessmentSessions))
    assessmentSessions.set(id, value);
  for (const [id, value] of Object.entries(store.reports))
    reports.set(id, value);
  for (const [id, value] of Object.entries(store.trainingPlans))
    trainingPlans.set(id, value);
  for (const [id, value] of Object.entries(store.postureSessions))
    postureSessions.set(id, value);
  for (const [id, value] of Object.entries(store.postureAssets))
    postureAssets.set(id, value.view);
}
export function hydrateStore(document: unknown): void {
  if (typeof document !== "object" || document === null)
    throw new Error("存储中的 BOKS 文档格式无效。");
  const hydrated = mergeStore(document as Partial<BoksStore>);
  hydrated.sessions = { ...store.sessions, ...hydrated.sessions };
  hydrated.identityBindings = {
    ...store.identityBindings,
    ...hydrated.identityBindings,
  };
  Object.assign(store, hydrated);
  children.splice(0, children.length, ...hydrated.children);
  for (const key of Object.keys(postureReports)) delete postureReports[key];
  Object.assign(postureReports, hydrated.postureReports);
  syncCollections();
}
function snapshot(): BoksStore {
  store.children = children;
  store.assessmentSessions = Object.fromEntries(assessmentSessions);
  store.reports = Object.fromEntries(reports);
  store.trainingPlans = Object.fromEntries(trainingPlans);
  store.postureSessions = Object.fromEntries(postureSessions);
  store.postureAssets = Object.fromEntries([
    ...(store.postureAssets ? Object.entries(store.postureAssets) : []),
    ...[...postureAssets]
      .filter(([id]) => !store.postureAssets[id])
      .map(([id, view]) => [
        id,
        {
          id,
          session_id: "",
          view: view as PostureView,
          metadata: { mime_type: "image/*", size_bytes: 0, captured_at: iso() },
        } as PostureAsset,
      ]),
  ]);
  return store;
}
export function familyDocuments(next: BoksStore): StoreDocument[] {
  const familyIds = new Set<string>([
    next.family_id,
    ...Object.keys(next.families),
    ...next.children.map((child) => child.family_id),
    ...Object.values(next.sessions).map((session) => session.family_id),
    ...Object.values(next.identityBindings).map((binding) => binding.family_id),
    ...Object.values(next.consents).map((consent) => consent.family_id),
    ...next.deletionRequests.map((item) => item.family_id),
  ]);
  return [...familyIds].map((familyId) => {
    const childIds = new Set(
      next.children
        .filter((child) => child.family_id === familyId)
        .map((child) => child.id),
    );
    const sessionIds = new Set(
      Object.values(next.postureSessions)
        .filter((session) => childIds.has(session.child_id))
        .map((session) => session.id),
    );
    const byChild = <T extends { child_id: string }>(
      values: Record<string, T>,
    ): Record<string, T> =>
      Object.fromEntries(
        Object.entries(values).filter(([, value]) =>
          childIds.has(value.child_id),
        ),
      );
    const document: BoksStore = {
      ...next,
      family_id: familyId,
      families: next.families[familyId]
        ? { [familyId]: next.families[familyId] }
        : {},
      children: next.children.filter((child) => child.family_id === familyId),
      assessmentSessions: Object.fromEntries(
        Object.entries(next.assessmentSessions).filter(([, item]) =>
          childIds.has(item.child_id),
        ),
      ),
      reports: byChild(next.reports),
      trainingPlans: byChild(next.trainingPlans),
      postureSessions: Object.fromEntries(
        Object.entries(next.postureSessions).filter(([, item]) =>
          childIds.has(item.child_id),
        ),
      ),
      postureAssets: Object.fromEntries(
        Object.entries(next.postureAssets).filter(([, item]) =>
          sessionIds.has(item.session_id),
        ),
      ),
      postureReports: byChild(next.postureReports),
      sessions: Object.fromEntries(
        Object.entries(next.sessions).filter(
          ([, item]) => item.family_id === familyId,
        ),
      ),
      identityBindings: Object.fromEntries(
        Object.entries(next.identityBindings).filter(
          ([, item]) => item.family_id === familyId,
        ),
      ),
      consents: Object.fromEntries(
        Object.entries(next.consents).filter(
          ([, item]) => item.family_id === familyId,
        ),
      ),
      checkIns: Object.fromEntries(
        Object.entries(next.checkIns).filter(([, item]) =>
          childIds.has(item.child_id),
        ),
      ),
      conversations: Object.fromEntries(
        Object.entries(next.conversations).filter(
          ([, item]) =>
            item.family_id === familyId &&
            (!item.child_id || childIds.has(item.child_id)),
        ),
      ),
      deletionRequests: next.deletionRequests.filter(
        (item) => item.family_id === familyId,
      ),
      auditEvents: familyId === next.family_id ? next.auditEvents : [],
    };
    return document as unknown as StoreDocument;
  });
}

export async function loadFamilyStore(familyId: string): Promise<BoksStore> {
  if (!isPostgresStorage()) return store;
  const document = await readFamilyDocument(familyId);
  if (!document) throw new Error(`PostgreSQL 家庭文档不存在：${familyId}`);
  const platform = await loadPlatformStore();
  return mergeStore({
    ...document,
    configuration: platform.configuration,
    knowledgeSources: platform.knowledgeSources,
    knowledgeVersions: platform.knowledgeVersions,
    auditEvents: platform.auditEvents,
  } as Partial<BoksStore>);
}

function platformStore(source: BoksStore): PlatformStore {
  return {
    configuration: source.configuration,
    knowledgeSources: source.knowledgeSources,
    knowledgeVersions: source.knowledgeVersions,
    auditEvents: source.auditEvents,
  };
}

function platformInput(source: {
  configuration: unknown;
  knowledgeSources: unknown;
  knowledgeVersions: unknown;
  auditEvents: unknown;
}): Partial<BoksStore> {
  return {
    configuration: source.configuration as StoreConfiguration,
    knowledgeSources: source.knowledgeSources as Record<
      string,
      KnowledgeSource
    >,
    knowledgeVersions: source.knowledgeVersions as Record<
      string,
      KnowledgeVersion
    >,
    auditEvents: source.auditEvents as AuditEvent[],
  };
}

export async function loadPlatformStore(): Promise<PlatformStore> {
  if (!isPostgresStorage()) return platformStore(store);
  const document = await readPlatformDocument();
  if (!document) return platformStore(store);
  return platformStore(mergeStore(platformInput(document)));
}

export async function updatePlatformStore(
  updater: (platform: PlatformStore) => void,
): Promise<PlatformStore> {
  if (!isPostgresStorage()) {
    updater(store);
    await persistStore();
    return platformStore(store);
  }
  const document = await updatePlatformDocument((current) => {
    const platform = platformStore(mergeStore(platformInput(current)));
    updater(platform);
    return {
      id: "global",
      ...platform,
    };
  });
  const next = platformStore(mergeStore(platformInput(document)));
  store.configuration = next.configuration;
  store.knowledgeSources = next.knowledgeSources;
  store.knowledgeVersions = next.knowledgeVersions;
  store.auditEvents = next.auditEvents;
  return next;
}

export async function updateFamilyStore(
  familyId: string,
  updater: (family: BoksStore) => void,
): Promise<BoksStore> {
  if (!isPostgresStorage()) {
    updater(store);
    syncCollections();
    await persistStore();
    return store;
  }
  const document = await updateFamilyDocument(familyId, (current) => {
    const family = mergeStore(current as Partial<BoksStore>);
    updater(family);
    const next = familyDocuments(family).find(
      (item) => item.family_id === familyId,
    );
    if (!next) throw new Error(`无法生成家庭文档：${familyId}`);
    return next;
  });
  const family = mergeStore(document as Partial<BoksStore>);
  store.families = {
    ...store.families,
    ...family.families,
  };
  const retainedChildren = store.children.filter(
    (child) => child.family_id !== familyId,
  );
  children.splice(0, children.length, ...retainedChildren, ...family.children);
  store.children = children;
  return family;
}

export function persistStore(next = snapshot()): Promise<void> {
  if (isPostgresStorage())
    return Promise.all(
      familyDocuments(next).map((document) => persistDocument(document)),
    ).then(() => undefined);
  return Promise.resolve().then(() => {
    const directory = dirname(filePath);
    mkdirSync(directory, { recursive: true });
    const temp = `${filePath}.${process.pid}.tmp`;
    writeFileSync(
      temp,
      JSON.stringify(
        {
          ...next,
          sessions: {},
          identityBindings: {},
        },
        null,
        2,
      ),
      "utf8",
    );
    renameSync(temp, filePath);
  });
}
export function resetDemoStore(): void {
  const fresh = emptyStore();
  Object.assign(store, fresh);
  children.splice(0, children.length, ...fresh.children);
  for (const key of Object.keys(postureReports)) delete postureReports[key];
  syncCollections();
  void persistStore();
}
export function seedDemoStore(): BoksStore {
  resetDemoStore();
  return store;
}
export function getChild(
  childId: string,
  familyId?: string,
): Child | undefined {
  return children.find(
    (child) =>
      child.id === childId &&
      child.profile_status === "active" &&
      (familyId === undefined || child.family_id === familyId),
  );
}
export function getAccount(accountId: string): Account | undefined {
  return store.accounts[accountId];
}
export function getAccountByUsername(username: string): Account | undefined {
  return Object.values(store.accounts).find(
    (account) => account.username === username,
  );
}
export function getAccountByPhone(phone: string): Account | undefined {
  return Object.values(store.accounts).find(
    (account) => account.phone === phone,
  );
}
export function getOrganization(orgId: string): Organization | undefined {
  return store.organizations[orgId];
}
export function hasSuperAdmin(): boolean {
  return Object.values(store.accounts).some(
    (account) => account.role === "super_admin" && account.status === "active",
  );
}
export function familyExists(familyId: string): boolean {
  return (
    store.families[familyId]?.status === "active" ||
    children.some(
      (child) =>
        child.family_id === familyId && child.profile_status === "active",
    )
  );
}
export async function initializeStore(): Promise<void> {
  await initializePostgresStore(snapshot(), hydrateStore);
  if (isPostgresStorage()) {
    const platform = await loadPlatformStore();
    store.configuration = platform.configuration;
    store.knowledgeSources = platform.knowledgeSources;
    store.knowledgeVersions = platform.knowledgeVersions;
    store.auditEvents = platform.auditEvents;
  }
}
export function getConfiguration(
  target: Pick<BoksStore, "configuration"> = store,
): StoreConfiguration {
  return target.configuration;
}
export function findStandard(
  id: string,
  target: Pick<BoksStore, "configuration"> = store,
): StandardConfiguration | undefined {
  return target.configuration.standards.find((item) => item.id === id);
}
export function getAssessmentSchema(
  child: Child,
  measurementDate: string,
  target: Pick<BoksStore, "configuration"> = store,
): AssessmentSchema {
  const selected =
    findStandard(
      child.school_stage === "preschool"
        ? "ref-demo-preschool-development-v0"
        : target.configuration.active_standard_id,
      target,
    ) ?? defaultConfiguration.standards[0];
  const indicators =
    selected.id === NATIONAL_2014_STANDARD_ID
      ? national2014Indicators(gradeOf(child))
      : selected.indicators;
  return {
    standard_version_id: selected.id,
    standard_name: selected.name,
    standard_status: selected.status,
    measurement_date: measurementDate,
    child_id: child.id,
    mode: selected.mode,
    indicators,
  };
}
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
function engineToScoreResults(
  engine: ContractEngineResult,
  schema: AssessmentSchema,
): ScoreResult[] {
  const labelByCode = new Map(
    schema.indicators.map((indicator) => [
      indicator.indicator_code,
      indicator.label,
    ]),
  );
  const unitByCode = new Map(
    schema.indicators.map((indicator) => [
      indicator.indicator_code,
      indicator.unit,
    ]),
  );
  return engine.results.map((item) => ({
    indicator_code: item.indicator_code,
    label:
      labelByCode.get(item.indicator_code) ??
      (item.indicator_code === "bmi" ? "身体质量指数（BMI）" : item.indicator_code),
    raw_value: item.raw_value,
    unit: unitByCode.get(item.indicator_code) ?? "",
    score: item.score,
    bonus: item.bonus,
    weight: item.weight,
    contribution: item.contribution,
    band_label: item.band_label,
    interpretation: item.interpretation,
    status: item.status,
  }));
}

export function calculateResults(
  schema: AssessmentSchema,
  values: AssessmentValue[],
  testStatus: "completed" | "makeup" | "exempt" | "deferred",
  target: BoksStore = store,
) {
  const selected =
    findStandard(schema.standard_version_id, target) ??
    defaultConfiguration.standards[0];
  if (selected.id === NATIONAL_2014_STANDARD_ID) {
    const child = target.children.find(
      (item) => item.id === schema.child_id,
    );
    if (!child) {
      const results: ScoreResult[] = [];
      return {
        results,
        totalScore: null,
        level: "reference_only" as const,
        completeness: 0,
        priorityActions: [],
        engineResults: null,
      };
    }
    const grade = gradeOf(child);
    const engine = scoreNational2014({ child, grade, values });
    const engineResults: ContractEngineResult = {
      ...engine,
      standard_id: selected.id,
      algorithm_version: NATIONAL_2014_ALGORITHM_VERSION,
    };
    const results = engineToScoreResults(engineResults, schema);
    const priorityActions = results
      .filter((item) => item.score !== null && item.score < 80)
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .slice(0, 3)
      .map((item) => `优先练习：${item.label}`);
    return {
      results,
      totalScore: engine.total_score,
      level: engine.level,
      completeness: engine.completeness,
      priorityActions,
      engineResults,
    };
  }
  const valueByCode = new Map(
    values.map((value) => [value.indicator_code, value]),
  );
  const results = schema.indicators.map((indicator) => {
    const submitted = valueByCode.get(indicator.indicator_code);
    const numeric = submitted ? Number(submitted.raw_value) : NaN;
    const valid =
      submitted !== undefined &&
      Number.isFinite(numeric) &&
      numeric >= indicator.min_value &&
      numeric <= indicator.max_value;
    const rule = selected.rules.find(
      (item) => item.indicator_code === indicator.indicator_code,
    );
    const canScore =
      schema.mode === "scored" &&
      valid &&
      rule !== undefined &&
      testStatus !== "exempt";
    const score =
      canScore && rule
        ? rule.score_bands && rule.score_bands.length > 0
          ? (rule.score_bands.find(
              (band) =>
                (band.min === null || numeric >= band.min) &&
                (band.max === null || numeric < band.max),
            )?.score ?? null)
          : clamp(
              60 +
                (rule.score_type === "lower_is_better"
                  ? rule.baseline - numeric
                  : numeric - rule.baseline) *
                  rule.points_per_unit,
              0,
              100,
            )
        : null;
    return {
      indicator_code: indicator.indicator_code,
      label: indicator.label,
      raw_value: submitted?.raw_value ?? "",
      unit: indicator.unit,
      score,
      bonus: 0,
      weight: rule?.weight ?? 0,
      contribution: Number(((score ?? 0) * (rule?.weight ?? 0)).toFixed(2)),
      band_label: "",
      interpretation:
        score === null
          ? schema.mode === "reference_only"
            ? "记录用于成长观察，不进入总评。"
            : "请补充合法数据。"
          : score >= 80
            ? "当前表现可继续保持。"
            : "可作为下一阶段的优先练习方向。",
      status:
        !valid && submitted !== undefined
          ? "needs_review"
          : score === null
            ? schema.mode === "reference_only"
              ? "reference_only"
              : "missing"
            : "scored",
    } satisfies ScoreResult;
  });
  const requiredCount = schema.indicators.filter(
    (item) => item.required,
  ).length;
  const completeness =
    requiredCount === 0
      ? 1
      : results.filter(
          (item) => item.raw_value.length > 0 && item.status !== "needs_review",
        ).length / requiredCount;
  const scored = results.filter((item) => item.score !== null);
  const requiredScoredCodes = schema.indicators
    .filter((item) => item.required)
    .map((item) => item.indicator_code)
    .filter((code) =>
      selected.rules.some((rule) => rule.indicator_code === code),
    );
  const allRequiredScored = requiredScoredCodes.every((code) =>
    results.some((item) => item.indicator_code === code && item.score !== null),
  );
  const totalScore =
    schema.mode === "scored" && scored.length > 0 && allRequiredScored
      ? Number(
          scored.reduce((sum, item) => sum + item.contribution, 0).toFixed(1),
        )
      : null;
  const level: AssessmentReport["level"] =
    schema.mode === "reference_only" || totalScore === null
      ? "reference_only"
      : totalScore >= 90
        ? "excellent"
        : totalScore >= 80
          ? "good"
          : totalScore >= 60
            ? "pass"
            : "fail";
  const priorityActions = results
    .filter((item) => item.score !== null && item.score < 80)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 3)
    .map((item) => `优先练习：${item.label}`);
  return {
    results,
    totalScore,
    level,
    completeness,
    priorityActions,
    engineResults: null,
  };
}
export function createAssessmentReport(
  sessionId: string,
  child: Child,
  schema: AssessmentSchema,
  values: AssessmentValue[],
  testStatus: "completed" | "makeup" | "exempt" | "deferred",
  target: BoksStore = store,
): AssessmentReport {
  const standard = findStandard(schema.standard_version_id, target);
  if (isProductionRuntime() && schema.standard_status !== "approved")
    throw new ForbiddenException({
      error: {
        code: "ASSESSMENT_STANDARD_NOT_RELEASED",
        message:
          "当前体测标准尚未完成 BOKS 内部审核发布，暂不能生成正式评分报告。",
        details: [],
        retryable: false,
      },
    });
  if (
    isProductionRuntime() &&
    schema.mode === "scored" &&
    (!standard ||
      (standard.id !== NATIONAL_2014_STANDARD_ID &&
        standard.rules.some((rule) => !rule.score_bands?.length)))
  )
    throw new ForbiddenException({
      error: {
        code: "ASSESSMENT_STANDARD_TABLE_NOT_READY",
        message: "正式评分表尚未完成结构化查表审核，暂不能生成评分报告。",
        details: [],
        retryable: false,
      },
    });
  const calculated = calculateResults(schema, values, testStatus, target);
  const report: AssessmentReport = {
    id: randomUUID(),
    report_type: "assessment",
    child_id: child.id,
    status: "ready",
    measurement_date: schema.measurement_date,
    standard_version_id: schema.standard_version_id,
    standard_name: schema.standard_name,
    standard_status: schema.standard_status,
    algorithm_version: target.configuration.algorithm_version,
    knowledge_snapshot_id: target.configuration.knowledge_snapshot_id,
    configuration_snapshot: structuredClone(target.configuration),
    mode: schema.mode,
    total_score: calculated.totalScore,
    level: calculated.level,
    completeness: calculated.completeness,
    priority_actions: calculated.priorityActions,
    results: calculated.results,
    engine_results: calculated.engineResults ?? undefined,
    limitations: [
      ...(schema.standard_status === "approved"
        ? []
        : [
            "当前评分配置是开发夹具，状态为 demo_pending_review，不能替代已审核标准。",
          ]),
      "本报告依据国家学生体质健康标准（2014 年修订）评分，仅作体能观察，不构成医疗建议或诊断。",
    ],
    source_references: (standard ?? defaultConfiguration.standards[0])
      .source_references,
    generated_at: iso(),
  };
  if (target === store) {
    reports.set(report.id, report);
    store.reports[report.id] = report;
  } else {
    target.reports[report.id] = report;
  }
  const session =
    target === store
      ? assessmentSessions.get(sessionId)
      : target.assessmentSessions[sessionId];
  if (session) {
    session.status = "reported";
    session.report_id = report.id;
  }
  if (target === store) void persistStore();
  return report;
}
export function createTrainingPlan(
  childId: string,
  sourceReportId: string | null,
  goal: string,
  durationWeeks: number,
  daysPerWeek: number,
  minutesPerSession: number,
  target: BoksStore = store,
): TrainingPlan {
  const items: TrainingPlan["items"] = [];
  const exerciseSets = [
    {
      phase: "warmup" as const,
      exercise_name: "趣味热身走",
      duration_minutes: 4,
      sets: 1,
      repetitions: null,
      safety_note: "保持可以正常说话的强度。",
      stop_condition: "出现疼痛、头晕或呼吸不适立即停止。",
    },
    {
      phase: "main" as const,
      exercise_name: goal.includes("耐力") ? "节奏跑走交替" : "基础协调跳",
      duration_minutes: Math.max(5, minutesPerSession - 10),
      sets: 2,
      repetitions: 10,
      safety_note: "动作稳定优先，不追求速度和数量。",
      stop_condition: "出现疼痛、麻木、无力或明显不适立即停止。",
    },
    {
      phase: "cooldown" as const,
      exercise_name: "呼吸放松与轻柔拉伸",
      duration_minutes: 4,
      sets: 1,
      repetitions: null,
      safety_note: "只做到舒适牵拉，不弹动、不强压。",
      stop_condition: "任何不适都应停止并告诉监护人。",
    },
  ];
  for (let week = 1; week <= durationWeeks; week += 1)
    for (let day = 1; day <= daysPerWeek; day += 1)
      for (const exercise of exerciseSets)
        items.push({ id: randomUUID(), week, day, ...exercise });
  const plan: TrainingPlan = {
    id: randomUUID(),
    child_id: childId,
    source_report_id: sourceReportId,
    goal,
    duration_weeks: durationWeeks,
    days_per_week: daysPerWeek,
    minutes_per_session: minutesPerSession,
    status: "active",
    safety_confirmed: true,
    items,
    content_version: "training-safe-content-1.0",
  };
  if (target === store) {
    trainingPlans.set(plan.id, plan);
    store.trainingPlans[plan.id] = plan;
  } else {
    target.trainingPlans[plan.id] = plan;
  }
  return plan;
}
export function createPostureSession(
  childId: string,
  consentRecordId: string,
  captureProtocolVersion: string,
  requiredViews: PostureView[],
  target: BoksStore = store,
): PostureSession {
  const views = Object.fromEntries(
    requiredViews.map((view) => [
      view,
      { status: "pending" as const, score: null, reasons: [] },
    ]),
  ) as PostureSession["quality"]["views"];
  const session: PostureSession = {
    id: randomUUID(),
    child_id: childId,
    status: "draft",
    required_views: requiredViews,
    attached_views: [],
    quality: { overall: "pending", views },
    analysis: null,
    limitations: [
      "普通照片不能诊断疾病，也不能替代专业评估。",
      "当前版本只验证四视角完整性，未接入生产姿态模型。",
    ],
    consent_record_id: consentRecordId,
    capture_protocol_version: captureProtocolVersion,
  };
  if (target === store) {
    postureSessions.set(session.id, session);
    store.postureSessions[session.id] = session;
    void persistStore();
  } else {
    target.postureSessions[session.id] = session;
  }
  return session;
}
