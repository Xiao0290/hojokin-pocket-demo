-- Hojokin Pocket Closed Beta alpha initial schema.
-- This migration defines persistence tables only; it does not enable production DB usage.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  name TEXT,
  prefecture TEXT,
  city TEXT,
  profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  citations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  unknowns_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS diagnoses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  events_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  license_status TEXT NOT NULL DEFAULT 'unresolved',
  commercial_use TEXT NOT NULL DEFAULT 'unresolved',
  redistribution TEXT NOT NULL DEFAULT 'unresolved',
  terms_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_records (
  id TEXT PRIMARY KEY,
  registry_source_id TEXT REFERENCES source_registry(id) ON DELETE SET NULL,
  external_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  raw_ref TEXT,
  fetched_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  review_status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subsidy_programs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  issuer_type TEXT NOT NULL,
  overview TEXT NOT NULL,
  source_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  source_record_id TEXT REFERENCES source_records(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subsidy_rounds (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES subsidy_programs(id) ON DELETE CASCADE,
  round_label TEXT NOT NULL,
  status TEXT NOT NULL,
  accept_start TIMESTAMPTZ,
  accept_end TIMESTAMPTZ,
  max_limit INTEGER,
  subsidy_rate TEXT,
  last_seen_at TIMESTAMPTZ,
  requirements_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  documents_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_record_id TEXT REFERENCES source_records(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subsidy_matches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  diagnosis_id TEXT NOT NULL REFERENCES diagnoses(id) ON DELETE CASCADE,
  round_id TEXT NOT NULL REFERENCES subsidy_rounds(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  score NUMERIC(8, 4) NOT NULL DEFAULT 0,
  eligible BOOLEAN NOT NULL DEFAULT false,
  reasons_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applicant_confirmations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  diagnosis_id TEXT NOT NULL REFERENCES diagnoses(id) ON DELETE CASCADE,
  round_id TEXT NOT NULL REFERENCES subsidy_rounds(id) ON DELETE CASCADE,
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'needs_confirmation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  diagnosis_id TEXT REFERENCES diagnoses(id) ON DELETE SET NULL,
  round_id TEXT NOT NULL REFERENCES subsidy_rounds(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  sections_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exported_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  plan_id TEXT NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  file_url TEXT,
  disclaimer_text TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  version TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  expert_id TEXT,
  round_id TEXT REFERENCES subsidy_rounds(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waitlist',
  consent_record_id TEXT REFERENCES consent_records(id) ON DELETE SET NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  deadline_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS source_extraction_runs (
  id TEXT PRIMARY KEY,
  registry_source_id TEXT REFERENCES source_registry(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  stats_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS source_field_citations (
  id TEXT PRIMARY KEY,
  source_record_id TEXT NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  citation_url TEXT NOT NULL,
  quote_hash TEXT,
  confidence NUMERIC(5, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_review_decisions (
  id TEXT PRIMARY KEY,
  source_record_id TEXT NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  reviewer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL DEFAULT 'user',
  event TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_user_company ON diagnoses(user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_matches_diagnosis_rank ON subsidy_matches(diagnosis_id, rank);
CREATE INDEX IF NOT EXISTS idx_plans_user_round ON business_plans(user_id, round_id);
CREATE INDEX IF NOT EXISTS idx_exports_plan_expires ON exported_files(plan_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_leads_user_status ON lead_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_records_review_status ON source_records(review_status);
CREATE INDEX IF NOT EXISTS idx_source_citations_record_field ON source_field_citations(source_record_id, field_name);
