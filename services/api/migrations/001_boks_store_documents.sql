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
