import type { Pool, PoolClient } from "pg";
import { Pool as PgPool } from "pg";
import { createHash } from "node:crypto";

type JsonRecord = Record<string, unknown>;

export type StoreDocument = {
  family_id: string;
  [key: string]: unknown;
};

export type PlatformDocument = {
  id: string;
  configuration: unknown;
  knowledgeSources: unknown;
  knowledgeVersions: unknown;
  auditEvents: unknown;
};

export type PersistedAuthState = {
  sessions: Array<{
    access_token_hash: string;
    refresh_token_hash: string;
    guardian_id: string;
    family_id: string;
    account_id?: string | null;
    role?: string | null;
    org_id?: string | null;
    expires_at: string;
    refresh_expires_at: string;
    revoked_at: string | null;
  }>;
  identity_bindings: Array<{
    provider: string;
    subject_hash: string;
    guardian_id: string;
    family_id: string;
    account_id?: string | null;
  }>;
};

const storageMode = process.env.BOKS_STORAGE_MODE ?? "json";
let pool: Pool | undefined;
let writeQueue: Promise<void> = Promise.resolve();
let authHydrator: ((state: PersistedAuthState) => void) | undefined;

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function registerAuthHydrator(
  hydrator: (state: PersistedAuthState) => void,
): void {
  authHydrator = hydrator;
}

export function isPostgresStorage(): boolean {
  return storageMode === "postgres";
}

export async function checkStorageHealth(): Promise<{
  mode: "json" | "postgres";
  ready: boolean;
}> {
  if (!isPostgresStorage()) return { mode: "json", ready: true };
  if (!pool) return { mode: "postgres", ready: false };
  try {
    await pool.query("SELECT 1");
    return { mode: "postgres", ready: true };
  } catch {
    return { mode: "postgres", ready: false };
  }
}

const schemaSql = `
  CREATE TABLE IF NOT EXISTS boks_store_documents (
    family_id TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS boks_store_documents_updated_at_idx
    ON boks_store_documents (updated_at);
  CREATE TABLE IF NOT EXISTS boks_platform_documents (
    id TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS boks_families (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'archived', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS boks_guardians (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS boks_family_memberships (
    family_id TEXT NOT NULL REFERENCES boks_families(id),
    guardian_id TEXT NOT NULL REFERENCES boks_guardians(id),
    role TEXT NOT NULL CHECK (role IN ('owner', 'guardian', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (family_id, guardian_id)
  );
  CREATE TABLE IF NOT EXISTS boks_identity_bindings (
    provider TEXT NOT NULL,
    subject_hash TEXT NOT NULL,
    guardian_id TEXT NOT NULL REFERENCES boks_guardians(id),
    family_id TEXT NOT NULL REFERENCES boks_families(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (provider, subject_hash)
  );
  CREATE TABLE IF NOT EXISTS boks_guardian_sessions (
    access_token_hash TEXT PRIMARY KEY,
    refresh_token_hash TEXT NOT NULL UNIQUE,
    guardian_id TEXT NOT NULL REFERENCES boks_guardians(id),
    family_id TEXT NOT NULL REFERENCES boks_families(id),
    expires_at TIMESTAMPTZ NOT NULL,
    refresh_expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS boks_guardian_sessions_family_idx
    ON boks_guardian_sessions (family_id, guardian_id);
  CREATE TABLE IF NOT EXISTS boks_children (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES boks_families(id),
    display_name TEXT NOT NULL,
    birth_date DATE NOT NULL,
    sex_code TEXT NOT NULL CHECK (sex_code IN ('female', 'male', 'unspecified')),
    school_stage TEXT NOT NULL
      CHECK (school_stage IN ('preschool', 'primary', 'junior_high', 'senior_high')),
    grade_code TEXT NOT NULL,
    profile_status TEXT NOT NULL
      CHECK (profile_status IN ('active', 'archived', 'deleted')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS boks_children_family_idx
    ON boks_children (family_id, profile_status);
  CREATE TABLE IF NOT EXISTS boks_consents (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES boks_families(id),
    child_id TEXT NOT NULL REFERENCES boks_children(id),
    purpose TEXT NOT NULL CHECK (purpose IN ('privacy', 'assessment', 'photo', 'voice')),
    version TEXT NOT NULL,
    granted BOOLEAN NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL,
    withdrawn_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS boks_assessment_sessions (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES boks_families(id),
    child_id TEXT NOT NULL REFERENCES boks_children(id),
    measurement_date DATE NOT NULL,
    standard_version_id TEXT NOT NULL,
    status TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS boks_assessment_reports (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES boks_families(id),
    child_id TEXT NOT NULL REFERENCES boks_children(id),
    measurement_date DATE NOT NULL,
    standard_version_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS boks_posture_sessions (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES boks_families(id),
    child_id TEXT NOT NULL REFERENCES boks_children(id),
    status TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS boks_posture_assets (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES boks_families(id),
    session_id TEXT NOT NULL REFERENCES boks_posture_sessions(id),
    view_code TEXT NOT NULL,
    storage_key TEXT,
    checksum_sha256 TEXT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS boks_training_plans (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES boks_families(id),
    child_id TEXT NOT NULL REFERENCES boks_children(id),
    status TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS boks_training_check_ins (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES boks_families(id),
    plan_id TEXT NOT NULL REFERENCES boks_training_plans(id),
    child_id TEXT NOT NULL REFERENCES boks_children(id),
    day INTEGER NOT NULL,
    status TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
  );
  CREATE TABLE IF NOT EXISTS boks_knowledge_sources (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    owner TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
  );
  CREATE TABLE IF NOT EXISTS boks_knowledge_versions (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES boks_knowledge_sources(id),
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS boks_deletion_requests (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES boks_families(id),
    child_id TEXT NOT NULL REFERENCES boks_children(id),
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    deleted_asset_count INTEGER NOT NULL DEFAULT 0,
    proof_hash TEXT
  );
  ALTER TABLE boks_deletion_requests
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
  ALTER TABLE boks_deletion_requests
    ADD COLUMN IF NOT EXISTS deleted_asset_count INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE boks_deletion_requests
    ADD COLUMN IF NOT EXISTS proof_hash TEXT;
  CREATE TABLE IF NOT EXISTS boks_chat_conversations (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES boks_families(id),
    child_id TEXT REFERENCES boks_children(id),
    context_report_id TEXT,
    context_plan_id TEXT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
  );
  CREATE TABLE IF NOT EXISTS boks_chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES boks_chat_conversations(id),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
  );
  CREATE TABLE IF NOT EXISTS boks_audit_events (
    id TEXT PRIMARY KEY,
    family_id TEXT,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb
  );
  CREATE INDEX IF NOT EXISTS boks_audit_events_created_idx
    ON boks_audit_events (created_at DESC);
  CREATE TABLE IF NOT EXISTS boks_standard_versions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('approved', 'demo_pending_review')),
    mode TEXT NOT NULL CHECK (mode IN ('scored', 'reference_only')),
    source_references JSONB NOT NULL,
    reviewers JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS boks_standard_indicators (
    standard_id TEXT NOT NULL REFERENCES boks_standard_versions(id),
    indicator_code TEXT NOT NULL,
    label TEXT NOT NULL,
    unit TEXT NOT NULL,
    input_type TEXT NOT NULL CHECK (input_type IN ('decimal', 'integer')),
    min_value NUMERIC NOT NULL,
    max_value NUMERIC NOT NULL,
    step NUMERIC NOT NULL,
    required BOOLEAN NOT NULL,
    help_text TEXT NOT NULL,
    PRIMARY KEY (standard_id, indicator_code)
  );
  CREATE TABLE IF NOT EXISTS boks_standard_score_bands (
    standard_id TEXT NOT NULL,
    indicator_code TEXT NOT NULL,
    band_index INTEGER NOT NULL,
    min_value NUMERIC,
    max_value NUMERIC,
    score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 100),
    PRIMARY KEY (standard_id, indicator_code, band_index),
    FOREIGN KEY (standard_id, indicator_code)
      REFERENCES boks_standard_indicators(standard_id, indicator_code)
  );
  CREATE TABLE IF NOT EXISTS boks_standard_rules (
    standard_id TEXT NOT NULL,
    indicator_code TEXT NOT NULL,
    score_type TEXT NOT NULL CHECK (score_type IN ('higher_is_better', 'lower_is_better')),
    baseline NUMERIC NOT NULL,
    points_per_unit NUMERIC NOT NULL,
    weight NUMERIC NOT NULL CHECK (weight >= 0 AND weight <= 1),
    PRIMARY KEY (standard_id, indicator_code),
    FOREIGN KEY (standard_id, indicator_code)
      REFERENCES boks_standard_indicators(standard_id, indicator_code)
  );
`;

function records(value: unknown): JsonRecord[] {
  if (typeof value !== "object" || value === null) return [];
  return Object.values(value).filter(
    (item): item is JsonRecord => typeof item === "object" && item !== null,
  );
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stripSensitiveAuthFields(document: StoreDocument): StoreDocument {
  return {
    ...document,
    sessions: {},
    identityBindings: {},
  };
}

function mergePersistedDocuments(
  seed: StoreDocument,
  documents: unknown[],
): StoreDocument {
  const merged: Record<string, unknown> = { ...seed };
  const mapKeys = new Set([
    "families",
    "organizations",
    "accounts",
    "assessmentSessions",
    "reports",
    "trainingPlans",
    "postureSessions",
    "postureAssets",
    "postureReports",
    "sessions",
    "identityBindings",
    "consents",
    "checkIns",
    "conversations",
    "knowledgeSources",
    "knowledgeVersions",
  ]);
  const arrayKeys = new Set(["children", "auditEvents", "deletionRequests"]);
  for (const document of documents) {
    if (typeof document !== "object" || document === null) continue;
    const record = document as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (key === "family_id" || value === undefined) continue;
      if (mapKeys.has(key)) {
        const current =
          typeof merged[key] === "object" && merged[key] !== null
            ? (merged[key] as Record<string, unknown>)
            : {};
        const incoming =
          typeof value === "object" && value !== null
            ? (value as Record<string, unknown>)
            : {};
        merged[key] = { ...current, ...incoming };
      } else if (arrayKeys.has(key)) {
        const current = Array.isArray(merged[key]) ? merged[key] : [];
        const incoming = Array.isArray(value) ? value : [];
        const byId = new Map<string, unknown>();
        for (const item of [...current, ...incoming]) {
          if (
            typeof item === "object" &&
            item !== null &&
            typeof (item as { id?: unknown }).id === "string"
          )
            byId.set((item as { id: string }).id, item);
          else byId.set(JSON.stringify(item), item);
        }
        merged[key] = [...byId.values()];
      } else {
        merged[key] = value;
      }
    }
  }
  return merged as StoreDocument;
}

async function syncRelationalTables(
  client: PoolClient,
  document: StoreDocument,
): Promise<void> {
  const familyId = document.family_id;
  const familyRecord = records(document.families).find(
    (item) => text(item.id) === familyId,
  );
  const familyName =
    text(familyRecord?.display_name) ??
    text(document.display_name) ??
    "BOKS 家庭";
  const familyStatus =
    text(familyRecord?.status) === "archived" ||
    text(familyRecord?.status) === "deleted"
      ? text(familyRecord?.status)
      : "active";
  await client.query(
    `
      INSERT INTO boks_families (id, display_name, status, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        status = EXCLUDED.status,
        updated_at = NOW()
    `,
    [familyId, familyName, familyStatus],
  );
  for (const statement of [
    "DELETE FROM boks_chat_messages WHERE conversation_id IN (SELECT id FROM boks_chat_conversations WHERE family_id = $1)",
    "DELETE FROM boks_chat_conversations WHERE family_id = $1",
    "DELETE FROM boks_training_check_ins WHERE family_id = $1",
    "DELETE FROM boks_training_plans WHERE family_id = $1",
    "DELETE FROM boks_posture_assets WHERE family_id = $1",
    "DELETE FROM boks_posture_sessions WHERE family_id = $1",
    "DELETE FROM boks_assessment_reports WHERE family_id = $1",
    "DELETE FROM boks_assessment_sessions WHERE family_id = $1",
    "DELETE FROM boks_consents WHERE family_id = $1",
    "DELETE FROM boks_deletion_requests WHERE family_id = $1",
    "DELETE FROM boks_children WHERE family_id = $1",
  ])
    await client.query(statement, [familyId]);

  const configuration =
    typeof document.configuration === "object" &&
    document.configuration !== null
      ? (document.configuration as JsonRecord)
      : {};
  const standards = [
    ...records(configuration.standards),
    ...records(configuration.candidates),
    ...records(configuration.history),
  ];
  const standardsById = new Map<string, JsonRecord>();
  for (const standard of standards) {
    const id = text(standard.id);
    if (id) standardsById.set(id, standard);
  }
  for (const standard of standardsById.values()) {
    const id = text(standard.id);
    const name = text(standard.name);
    const status = text(standard.status);
    const mode = text(standard.mode);
    if (
      !id ||
      !name ||
      (status !== "approved" && status !== "demo_pending_review") ||
      (mode !== "scored" && mode !== "reference_only")
    )
      continue;
    await client.query(
      `
        INSERT INTO boks_standard_versions (
          id, name, status, mode, source_references, reviewers, updated_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          mode = EXCLUDED.mode,
          source_references = EXCLUDED.source_references,
          reviewers = EXCLUDED.reviewers,
          updated_at = NOW()
      `,
      [
        id,
        name,
        status,
        mode,
        JSON.stringify(
          Array.isArray(standard.source_references)
            ? standard.source_references
            : [],
        ),
        JSON.stringify(
          Array.isArray(standard.reviewers) ? standard.reviewers : [],
        ),
      ],
    );
    await client.query(
      "DELETE FROM boks_standard_score_bands WHERE standard_id = $1",
      [id],
    );
    await client.query(
      "DELETE FROM boks_standard_rules WHERE standard_id = $1",
      [id],
    );
    await client.query(
      "DELETE FROM boks_standard_indicators WHERE standard_id = $1",
      [id],
    );
    const indicators = Array.isArray(standard.indicators)
      ? standard.indicators
      : [];
    for (const indicator of indicators) {
      if (
        typeof indicator !== "object" ||
        indicator === null ||
        !text(indicator.indicator_code) ||
        !text(indicator.label) ||
        !text(indicator.unit) ||
        !text(indicator.input_type) ||
        !text(indicator.help_text) ||
        typeof indicator.min_value !== "number" ||
        typeof indicator.max_value !== "number" ||
        typeof indicator.step !== "number" ||
        typeof indicator.required !== "boolean"
      )
        continue;
      await client.query(
        `
          INSERT INTO boks_standard_indicators (
            standard_id, indicator_code, label, unit, input_type, min_value,
            max_value, step, required, help_text
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          id,
          indicator.indicator_code,
          indicator.label,
          indicator.unit,
          indicator.input_type,
          indicator.min_value,
          indicator.max_value,
          indicator.step,
          indicator.required,
          indicator.help_text,
        ],
      );
    }
    const rules = Array.isArray(standard.rules) ? standard.rules : [];
    for (const rule of rules) {
      if (
        typeof rule !== "object" ||
        rule === null ||
        !text(rule.indicator_code) ||
        !text(rule.score_type) ||
        (rule.score_type !== "higher_is_better" &&
          rule.score_type !== "lower_is_better") ||
        typeof rule.baseline !== "number" ||
        typeof rule.points_per_unit !== "number" ||
        typeof rule.weight !== "number"
      )
        continue;
      await client.query(
        `
          INSERT INTO boks_standard_rules (
            standard_id, indicator_code, score_type, baseline,
            points_per_unit, weight
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          id,
          rule.indicator_code,
          rule.score_type,
          rule.baseline,
          rule.points_per_unit,
          rule.weight,
        ],
      );
      const scoreBands = Array.isArray(rule.score_bands)
        ? rule.score_bands
        : [];
      for (const [index, band] of scoreBands.entries()) {
        if (
          typeof band !== "object" ||
          band === null ||
          typeof band.score !== "number" ||
          (band.min !== null && typeof band.min !== "number") ||
          (band.max !== null && typeof band.max !== "number")
        )
          continue;
        await client.query(
          `
            INSERT INTO boks_standard_score_bands (
              standard_id, indicator_code, band_index, min_value, max_value,
              score
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [id, rule.indicator_code, index, band.min, band.max, band.score],
        );
      }
    }
  }

  const sessionRecords = records(document.sessions);
  const identityRecords = records(document.identityBindings);
  const guardianIds = new Set<string>();
  for (const item of sessionRecords) {
    const guardianId = text(item.guardian_id);
    if (guardianId) guardianIds.add(guardianId);
  }
  for (const item of identityRecords) {
    const guardianId = text(item.guardian_id);
    if (guardianId) guardianIds.add(guardianId);
  }
  for (const guardianId of guardianIds) {
    await client.query(
      `
        INSERT INTO boks_guardians (id, updated_at)
        VALUES ($1, NOW())
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
      `,
      [guardianId],
    );
    await client.query(
      `
        INSERT INTO boks_family_memberships (family_id, guardian_id, role)
        VALUES ($1, $2, 'guardian')
        ON CONFLICT (family_id, guardian_id)
        DO UPDATE SET status = 'active'
      `,
      [familyId, guardianId],
    );
  }

  for (const binding of identityRecords) {
    const provider = text(binding.provider);
    const subject = text(binding.subject);
    const guardianId = text(binding.guardian_id);
    const bindingFamilyId = text(binding.family_id);
    if (!provider || !subject || !guardianId || !bindingFamilyId) continue;
    await client.query(
      `
        INSERT INTO boks_identity_bindings (
          provider, subject_hash, guardian_id, family_id
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (provider, subject_hash)
        DO UPDATE SET guardian_id = EXCLUDED.guardian_id,
          family_id = EXCLUDED.family_id
      `,
      [provider, hashSecret(subject), guardianId, bindingFamilyId],
    );
  }
  for (const session of sessionRecords) {
    const accessToken = text(session.token);
    const refreshToken = text(session.refresh_token);
    const guardianId = text(session.guardian_id);
    const sessionFamilyId = text(session.family_id);
    const expiresAt = text(session.expires_at);
    const refreshExpiresAt = text(session.refresh_expires_at);
    if (
      !accessToken ||
      !refreshToken ||
      !guardianId ||
      !sessionFamilyId ||
      !expiresAt ||
      !refreshExpiresAt
    )
      continue;
    await client.query(
      `
        INSERT INTO boks_guardian_sessions (
          access_token_hash, refresh_token_hash, guardian_id, family_id,
          expires_at, refresh_expires_at, revoked_at
        )
        VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7::timestamptz)
        ON CONFLICT (access_token_hash)
        DO UPDATE SET
          refresh_token_hash = EXCLUDED.refresh_token_hash,
          guardian_id = EXCLUDED.guardian_id,
          family_id = EXCLUDED.family_id,
          expires_at = EXCLUDED.expires_at,
          refresh_expires_at = EXCLUDED.refresh_expires_at,
          revoked_at = EXCLUDED.revoked_at
      `,
      [
        hashSecret(accessToken),
        hashSecret(refreshToken),
        guardianId,
        sessionFamilyId,
        expiresAt,
        refreshExpiresAt,
        text(session.revoked_at) ?? null,
      ],
    );
  }

  const children = Array.isArray(document.children) ? document.children : [];
  for (const child of children) {
    if (
      !text(child.id) ||
      !text(child.display_name) ||
      !text(child.birth_date) ||
      !text(child.sex_code) ||
      !text(child.school_stage) ||
      !text(child.grade_code) ||
      !text(child.profile_status)
    )
      continue;
    await client.query(
      `
        INSERT INTO boks_children (
          id, family_id, display_name, birth_date, sex_code, school_stage,
          grade_code, profile_status, payload, updated_at
        )
        VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          family_id = EXCLUDED.family_id,
          display_name = EXCLUDED.display_name,
          birth_date = EXCLUDED.birth_date,
          sex_code = EXCLUDED.sex_code,
          school_stage = EXCLUDED.school_stage,
          grade_code = EXCLUDED.grade_code,
          profile_status = EXCLUDED.profile_status,
          payload = EXCLUDED.payload,
          updated_at = NOW()
      `,
      [
        child.id,
        familyId,
        child.display_name,
        child.birth_date,
        child.sex_code,
        child.school_stage,
        child.grade_code,
        child.profile_status,
        JSON.stringify(child),
      ],
    );
  }

  for (const consent of records(document.consents)) {
    if (
      !text(consent.id) ||
      !text(consent.child_id) ||
      !text(consent.purpose) ||
      !text(consent.version) ||
      !text(consent.granted_at)
    )
      continue;
    await client.query(
      `
        INSERT INTO boks_consents (
          id, family_id, child_id, purpose, version, granted, granted_at,
          withdrawn_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz)
        ON CONFLICT (id)
        DO UPDATE SET
          granted = EXCLUDED.granted,
          version = EXCLUDED.version,
          granted_at = EXCLUDED.granted_at,
          withdrawn_at = EXCLUDED.withdrawn_at
      `,
      [
        consent.id,
        familyId,
        consent.child_id,
        consent.purpose,
        consent.version,
        consent.granted === true,
        consent.granted_at,
        text(consent.withdrawn_at) ?? null,
      ],
    );
  }

  for (const session of records(document.assessmentSessions)) {
    if (
      !text(session.id) ||
      !text(session.child_id) ||
      !text(session.measurement_date) ||
      !text(session.standard_version_id) ||
      !text(session.status)
    )
      continue;
    await client.query(
      `
        INSERT INTO boks_assessment_sessions (
          id, family_id, child_id, measurement_date, standard_version_id,
          status, payload, updated_at
        )
        VALUES ($1, $2, $3, $4::date, $5, $6, $7::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          family_id = EXCLUDED.family_id,
          child_id = EXCLUDED.child_id,
          measurement_date = EXCLUDED.measurement_date,
          standard_version_id = EXCLUDED.standard_version_id,
          status = EXCLUDED.status,
          payload = EXCLUDED.payload,
          updated_at = NOW()
      `,
      [
        session.id,
        familyId,
        session.child_id,
        session.measurement_date,
        session.standard_version_id,
        session.status,
        JSON.stringify(session),
      ],
    );
  }

  for (const report of records(document.reports)) {
    if (
      !text(report.id) ||
      !text(report.child_id) ||
      !text(report.measurement_date) ||
      !text(report.standard_version_id)
    )
      continue;
    await client.query(
      `
        INSERT INTO boks_assessment_reports (
          id, family_id, child_id, measurement_date, standard_version_id, payload
        )
        VALUES ($1, $2, $3, $4::date, $5, $6::jsonb)
        ON CONFLICT (id)
        DO UPDATE SET payload = EXCLUDED.payload
      `,
      [
        report.id,
        familyId,
        report.child_id,
        report.measurement_date,
        report.standard_version_id,
        JSON.stringify(report),
      ],
    );
  }

  const postureSessionRecords = records(document.postureSessions);
  for (const session of postureSessionRecords) {
    if (!text(session.id) || !text(session.child_id) || !text(session.status))
      continue;
    await client.query(
      `
        INSERT INTO boks_posture_sessions (
          id, family_id, child_id, status, payload, updated_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          family_id = EXCLUDED.family_id,
          child_id = EXCLUDED.child_id,
          status = EXCLUDED.status,
          payload = EXCLUDED.payload,
          updated_at = NOW()
      `,
      [
        session.id,
        familyId,
        session.child_id,
        session.status,
        JSON.stringify(session),
      ],
    );
  }
  for (const asset of records(document.postureAssets)) {
    if (!text(asset.id) || !text(asset.session_id) || !text(asset.view))
      continue;
    const metadata =
      typeof asset.metadata === "object" && asset.metadata !== null
        ? (asset.metadata as JsonRecord)
        : {};
    await client.query(
      `
        INSERT INTO boks_posture_assets (
          id, family_id, session_id, view_code, storage_key, checksum_sha256,
          payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT (id)
        DO UPDATE SET
          family_id = EXCLUDED.family_id,
          session_id = EXCLUDED.session_id,
          view_code = EXCLUDED.view_code,
          storage_key = EXCLUDED.storage_key,
          checksum_sha256 = EXCLUDED.checksum_sha256,
          payload = EXCLUDED.payload
      `,
      [
        asset.id,
        familyId,
        asset.session_id,
        asset.view,
        text(metadata.storage_key) ?? null,
        text(metadata.checksum_sha256) ?? null,
        JSON.stringify(asset),
      ],
    );
  }

  for (const plan of records(document.trainingPlans)) {
    if (!text(plan.id) || !text(plan.child_id) || !text(plan.status)) continue;
    await client.query(
      `
        INSERT INTO boks_training_plans (
          id, family_id, child_id, status, payload, updated_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          family_id = EXCLUDED.family_id,
          child_id = EXCLUDED.child_id,
          status = EXCLUDED.status,
          payload = EXCLUDED.payload,
          updated_at = NOW()
      `,
      [plan.id, familyId, plan.child_id, plan.status, JSON.stringify(plan)],
    );
  }
  for (const checkIn of records(document.checkIns)) {
    if (
      !text(checkIn.id) ||
      !text(checkIn.plan_id) ||
      !text(checkIn.child_id) ||
      typeof checkIn.day !== "number" ||
      !text(checkIn.status) ||
      !text(checkIn.created_at)
    )
      continue;
    await client.query(
      `
        INSERT INTO boks_training_check_ins (
          id, family_id, plan_id, child_id, day, status, payload, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz)
        ON CONFLICT (id)
        DO UPDATE SET
          family_id = EXCLUDED.family_id,
          plan_id = EXCLUDED.plan_id,
          child_id = EXCLUDED.child_id,
          day = EXCLUDED.day,
          status = EXCLUDED.status,
          payload = EXCLUDED.payload
      `,
      [
        checkIn.id,
        familyId,
        checkIn.plan_id,
        checkIn.child_id,
        checkIn.day,
        checkIn.status,
        JSON.stringify(checkIn),
        checkIn.created_at,
      ],
    );
  }

  for (const conversation of records(document.conversations)) {
    if (
      !text(conversation.id) ||
      !text(conversation.created_at) ||
      (conversation.child_id !== null &&
        conversation.child_id !== undefined &&
        !text(conversation.child_id))
    )
      continue;
    await client.query(
      `
        INSERT INTO boks_chat_conversations (
          id, family_id, child_id, context_report_id, context_plan_id,
          payload, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)
        ON CONFLICT (id)
        DO UPDATE SET
          family_id = EXCLUDED.family_id,
          child_id = EXCLUDED.child_id,
          context_report_id = EXCLUDED.context_report_id,
          context_plan_id = EXCLUDED.context_plan_id,
          payload = EXCLUDED.payload
      `,
      [
        conversation.id,
        familyId,
        text(conversation.child_id) ?? null,
        text(conversation.context_report_id) ?? null,
        text(conversation.context_plan_id) ?? null,
        JSON.stringify(conversation),
        conversation.created_at,
      ],
    );
    const messages = Array.isArray(conversation.messages)
      ? conversation.messages
      : [];
    for (const message of messages) {
      if (
        typeof message !== "object" ||
        message === null ||
        !text(message.id) ||
        (message.role !== "user" && message.role !== "assistant") ||
        !text(message.content) ||
        !text(message.created_at)
      )
        continue;
      await client.query(
        `
          INSERT INTO boks_chat_messages (
            id, conversation_id, role, content, citations, payload, created_at
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::timestamptz)
          ON CONFLICT (id)
          DO UPDATE SET
            conversation_id = EXCLUDED.conversation_id,
            role = EXCLUDED.role,
            content = EXCLUDED.content,
            citations = EXCLUDED.citations,
            payload = EXCLUDED.payload
        `,
        [
          message.id,
          conversation.id,
          message.role,
          message.content,
          JSON.stringify(
            Array.isArray(message.citations) ? message.citations : [],
          ),
          JSON.stringify(message),
          message.created_at,
        ],
      );
    }
  }

  for (const source of records(document.knowledgeSources)) {
    if (
      !text(source.id) ||
      !text(source.title) ||
      !text(source.owner) ||
      !text(source.created_at)
    )
      continue;
    await client.query(
      `
        INSERT INTO boks_knowledge_sources (id, title, owner, created_at)
        VALUES ($1, $2, $3, $4::timestamptz)
        ON CONFLICT (id)
        DO UPDATE SET title = EXCLUDED.title, owner = EXCLUDED.owner
      `,
      [source.id, source.title, source.owner, source.created_at],
    );
  }
  for (const version of records(document.knowledgeVersions)) {
    if (
      !text(version.id) ||
      !text(version.source_id) ||
      !text(version.version) ||
      !text(version.title) ||
      !text(version.status)
    )
      continue;
    const content = text(version.content) ?? "";
    await client.query(
      `
        INSERT INTO boks_knowledge_versions (
          id, source_id, version, title, status, content_hash, payload,
          published_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz)
        ON CONFLICT (id)
        DO UPDATE SET
          source_id = EXCLUDED.source_id,
          version = EXCLUDED.version,
          title = EXCLUDED.title,
          status = EXCLUDED.status,
          content_hash = EXCLUDED.content_hash,
          payload = EXCLUDED.payload,
          published_at = EXCLUDED.published_at
      `,
      [
        version.id,
        version.source_id,
        version.version,
        version.title,
        version.status,
        hashSecret(content),
        JSON.stringify(version),
        text(version.published_at) ?? null,
      ],
    );
  }
  for (const deletion of records(document.deletionRequests)) {
    if (
      !text(deletion.id) ||
      !text(deletion.child_id) ||
      !text(deletion.status) ||
      !text(deletion.created_at)
    )
      continue;
    await client.query(
      `
        INSERT INTO boks_deletion_requests (
          id, family_id, child_id, status, created_at, completed_at,
          deleted_asset_count, proof_hash
        )
        VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8)
        ON CONFLICT (id)
        DO UPDATE SET
          status = EXCLUDED.status,
          completed_at = EXCLUDED.completed_at,
          deleted_asset_count = EXCLUDED.deleted_asset_count,
          proof_hash = EXCLUDED.proof_hash
      `,
      [
        deletion.id,
        familyId,
        deletion.child_id,
        deletion.status,
        deletion.created_at,
        text(deletion.completed_at) ?? null,
        typeof deletion.deleted_asset_count === "number"
          ? deletion.deleted_asset_count
          : 0,
        text(deletion.proof_hash) ?? null,
      ],
    );
  }

  const auditEvents = Array.isArray(document.auditEvents)
    ? document.auditEvents
    : [];
  for (const event of auditEvents) {
    if (
      typeof event !== "object" ||
      event === null ||
      !text(event.id) ||
      !text(event.action) ||
      !text(event.actor) ||
      !text(event.created_at)
    )
      continue;
    await client.query(
      `
        INSERT INTO boks_audit_events (
          id, family_id, action, actor, created_at, payload
        )
        VALUES ($1, $2, $3, $4, $5::timestamptz, $6::jsonb)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        event.id,
        familyId,
        event.action,
        event.actor,
        event.created_at,
        JSON.stringify(event),
      ],
    );
  }
}

export async function initializePostgresStore(
  seed: StoreDocument,
  hydrate: (document: unknown) => void,
): Promise<void> {
  if (!isPostgresStorage()) return;
  const connectionString = process.env.BOKS_DATABASE_URL;
  if (!connectionString)
    throw new Error(
      "BOKS_STORAGE_MODE=postgres 时必须配置 BOKS_DATABASE_URL。",
    );
  pool = new PgPool({
    connectionString,
    max: Number(process.env.BOKS_DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl:
      process.env.BOKS_DATABASE_SSL === "true"
        ? { rejectUnauthorized: true }
        : undefined,
  });
  await pool.query(schemaSql);
  const result = await pool.query<{ family_id: string; payload: unknown }>(
    "SELECT family_id, payload FROM boks_store_documents ORDER BY updated_at",
  );
  if (result.rows.length > 0)
    hydrate(
      mergePersistedDocuments(
        seed,
        result.rows.map((row) => row.payload),
      ),
    );
  else await persistDocument(seed);
  if (authHydrator) {
    const [sessions, identityBindings] = await Promise.all([
      pool.query<PersistedAuthState["sessions"][number]>(
        `
          SELECT access_token_hash, refresh_token_hash, guardian_id, family_id,
            expires_at::text, refresh_expires_at::text, revoked_at::text
          FROM boks_guardian_sessions
        `,
      ),
      pool.query<PersistedAuthState["identity_bindings"][number]>(
        `
          SELECT provider, subject_hash, guardian_id, family_id
          FROM boks_identity_bindings
        `,
      ),
    ]);
    authHydrator({
      sessions: sessions.rows,
      identity_bindings: identityBindings.rows,
    });
  }
  if (!(await readPlatformDocument()))
    await persistPlatformDocument({
      id: "global",
      configuration: seed.configuration,
      knowledgeSources: seed.knowledgeSources,
      knowledgeVersions: seed.knowledgeVersions,
      auditEvents: seed.auditEvents,
    });
}

function parsePlatformDocument(value: unknown): PlatformDocument {
  if (typeof value !== "object" || value === null)
    throw new Error("PostgreSQL 平台配置文档格式无效。");
  const document = value as Partial<PlatformDocument>;
  if (
    typeof document.configuration !== "object" ||
    document.configuration === null ||
    typeof document.knowledgeSources !== "object" ||
    document.knowledgeSources === null ||
    typeof document.knowledgeVersions !== "object" ||
    document.knowledgeVersions === null ||
    !Array.isArray(document.auditEvents)
  )
    throw new Error("PostgreSQL 平台配置文档字段无效。");
  return {
    id: typeof document.id === "string" ? document.id : "global",
    configuration: document.configuration,
    knowledgeSources: document.knowledgeSources,
    knowledgeVersions: document.knowledgeVersions,
    auditEvents: document.auditEvents,
  };
}

export function persistPlatformDocument(
  document: PlatformDocument,
): Promise<void> {
  if (!isPostgresStorage()) return Promise.resolve();
  if (!pool)
    return Promise.reject(
      new Error("PostgreSQL 存储尚未初始化，拒绝写入平台配置。"),
    );
  return enqueueWrite(async () => {
    await pool!.query(
      `
        INSERT INTO boks_platform_documents (id, payload, updated_at)
        VALUES ('global', $1::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `,
      [JSON.stringify({ ...document, id: "global" })],
    );
  });
}

export async function readPlatformDocument(): Promise<
  PlatformDocument | undefined
> {
  if (!isPostgresStorage()) return undefined;
  if (!pool) throw new Error("PostgreSQL 存储尚未初始化，拒绝读取平台配置。");
  await writeQueue;
  const result = await pool.query<{ payload: unknown }>(
    "SELECT payload FROM boks_platform_documents WHERE id = 'global'",
  );
  const payload = result.rows[0]?.payload;
  return payload === undefined ? undefined : parsePlatformDocument(payload);
}

export function updatePlatformDocument(
  updater: (document: PlatformDocument) => PlatformDocument,
): Promise<PlatformDocument> {
  if (!isPostgresStorage())
    return Promise.reject(
      new Error("只有 PostgreSQL 存储支持事务式平台配置更新。"),
    );
  if (!pool)
    return Promise.reject(
      new Error("PostgreSQL 存储尚未初始化，拒绝更新平台配置。"),
    );
  return enqueueWrite(async () => {
    const client = await pool!.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ payload: unknown }>(
        "SELECT payload FROM boks_platform_documents WHERE id = 'global' FOR UPDATE",
      );
      const payload = result.rows[0]?.payload;
      if (payload === undefined)
        throw new Error("PostgreSQL 平台配置文档不存在。");
      const next = parsePlatformDocument(
        updater(parsePlatformDocument(payload)),
      );
      await client.query(
        `
          UPDATE boks_platform_documents
          SET payload = $1::jsonb, updated_at = NOW()
          WHERE id = 'global'
        `,
        [JSON.stringify({ ...next, id: "global" })],
      );
      await client.query("COMMIT");
      return next;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}

export function persistDocument(document: StoreDocument): Promise<void> {
  if (!isPostgresStorage()) return Promise.resolve();
  if (!pool)
    return Promise.reject(
      new Error("PostgreSQL 存储尚未初始化，拒绝写入业务数据。"),
    );
  return enqueueWrite(async () => {
    const client = await pool!.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
          INSERT INTO boks_store_documents (family_id, payload, updated_at)
          VALUES ($1, $2::jsonb, NOW())
          ON CONFLICT (family_id)
          DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
        `,
        [
          document.family_id,
          JSON.stringify(stripSensitiveAuthFields(document)),
        ],
      );
      await syncRelationalTables(client, document);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}

export async function readFamilyDocument(
  familyId: string,
): Promise<StoreDocument | undefined> {
  if (!isPostgresStorage()) return undefined;
  if (!pool) throw new Error("PostgreSQL 存储尚未初始化，拒绝读取业务数据。");
  await writeQueue;
  const result = await pool.query<{ payload: unknown }>(
    "SELECT payload FROM boks_store_documents WHERE family_id = $1",
    [familyId],
  );
  const payload = result.rows[0]?.payload;
  if (typeof payload !== "object" || payload === null) return undefined;
  return { ...(payload as StoreDocument), family_id: familyId };
}

export function updateFamilyDocument(
  familyId: string,
  updater: (document: StoreDocument) => StoreDocument,
): Promise<StoreDocument> {
  if (!isPostgresStorage())
    return Promise.reject(
      new Error("只有 PostgreSQL 存储支持事务式家庭文档更新。"),
    );
  if (!pool)
    return Promise.reject(
      new Error("PostgreSQL 存储尚未初始化，拒绝更新业务数据。"),
    );
  return enqueueWrite(async () => {
    const client = await pool!.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ payload: unknown }>(
        "SELECT payload FROM boks_store_documents WHERE family_id = $1 FOR UPDATE",
        [familyId],
      );
      const payload = result.rows[0]?.payload;
      if (typeof payload !== "object" || payload === null)
        throw new Error(`家庭文档不存在：${familyId}`);
      const next = updater({
        ...(payload as StoreDocument),
        family_id: familyId,
      });
      const normalized = { ...next, family_id: familyId };
      await client.query(
        `
          UPDATE boks_store_documents
          SET payload = $2::jsonb, updated_at = NOW()
          WHERE family_id = $1
        `,
        [familyId, JSON.stringify(stripSensitiveAuthFields(normalized))],
      );
      await syncRelationalTables(client, normalized);
      await client.query("COMMIT");
      return normalized;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}

export function persistAuthSession(session: {
  token: string;
  refresh_token: string;
  guardian_id: string;
  family_id: string;
  expires_at: string;
  refresh_expires_at: string;
  revoked_at: string | null;
}): Promise<void> {
  if (!isPostgresStorage()) return Promise.resolve();
  if (!pool)
    return Promise.reject(
      new Error("PostgreSQL 存储尚未初始化，拒绝保存会话。"),
    );
  return enqueueWrite(async () => {
    const client = await pool!.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
          INSERT INTO boks_guardians (id, updated_at)
          VALUES ($1, NOW())
          ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
        `,
        [session.guardian_id],
      );
      await client.query(
        `
          INSERT INTO boks_family_memberships (family_id, guardian_id, role)
          VALUES ($1, $2, 'guardian')
          ON CONFLICT (family_id, guardian_id)
          DO UPDATE SET status = 'active'
        `,
        [session.family_id, session.guardian_id],
      );
      await client.query(
        `
          INSERT INTO boks_guardian_sessions (
            access_token_hash, refresh_token_hash, guardian_id, family_id,
            expires_at, refresh_expires_at, revoked_at
          )
          VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7::timestamptz)
          ON CONFLICT (access_token_hash)
          DO UPDATE SET
            refresh_token_hash = EXCLUDED.refresh_token_hash,
            guardian_id = EXCLUDED.guardian_id,
            family_id = EXCLUDED.family_id,
            expires_at = EXCLUDED.expires_at,
            refresh_expires_at = EXCLUDED.refresh_expires_at,
            revoked_at = EXCLUDED.revoked_at
        `,
        [
          hashSecret(session.token),
          hashSecret(session.refresh_token),
          session.guardian_id,
          session.family_id,
          session.expires_at,
          session.refresh_expires_at,
          session.revoked_at,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}

export function persistIdentityBinding(binding: {
  provider: string;
  subject: string;
  guardian_id: string;
  family_id: string;
}): Promise<void> {
  if (!isPostgresStorage()) return Promise.resolve();
  if (!pool)
    return Promise.reject(
      new Error("PostgreSQL 存储尚未初始化，拒绝保存身份绑定。"),
    );
  return enqueueWrite(async () => {
    const client = await pool!.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
          INSERT INTO boks_guardians (id, updated_at)
          VALUES ($1, NOW())
          ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
        `,
        [binding.guardian_id],
      );
      await client.query(
        `
          INSERT INTO boks_family_memberships (family_id, guardian_id, role)
          VALUES ($1, $2, 'guardian')
          ON CONFLICT (family_id, guardian_id)
          DO UPDATE SET status = 'active'
        `,
        [binding.family_id, binding.guardian_id],
      );
      await client.query(
        `
          INSERT INTO boks_identity_bindings (
            provider, subject_hash, guardian_id, family_id
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (provider, subject_hash)
          DO UPDATE SET guardian_id = EXCLUDED.guardian_id,
            family_id = EXCLUDED.family_id
        `,
        [
          binding.provider,
          hashSecret(binding.subject),
          binding.guardian_id,
          binding.family_id,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}

export function revokePersistedSession(accessTokenHash: string): Promise<void> {
  if (!isPostgresStorage()) return Promise.resolve();
  if (!pool)
    return Promise.reject(
      new Error("PostgreSQL 存储尚未初始化，拒绝吊销会话。"),
    );
  return enqueueWrite(async () => {
    await pool!.query(
      `
        UPDATE boks_guardian_sessions
        SET revoked_at = NOW()
        WHERE access_token_hash = $1
      `,
      [accessTokenHash],
    );
  });
}

export async function closeStorage(): Promise<void> {
  await writeQueue;
  await pool?.end();
  pool = undefined;
}
