-- Core schema for the AI Interviewer platform.
-- Works on plain PostgreSQL 14+ and on Supabase Postgres.
-- Tenant isolation is enforced with Row Level Security keyed on the
-- transaction-local setting `app.org_id` (see lib/database/db.ts).

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
create or replace function app_current_org() returns uuid
language sql stable as $$
  select nullif(current_setting('app.org_id', true), '')::uuid
$$;

-- System context (auth bootstrap, public token lookup, background workers).
create or replace function app_is_system() returns boolean
language sql stable as $$
  select coalesce(current_setting('app.system', true), '') = 'on'
$$;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Identity (not tenant-owned)
-- ---------------------------------------------------------------------------
create table users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index sessions_user_idx on sessions(user_id);

create table password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create type member_role as enum ('owner', 'admin', 'recruiter', 'interviewer', 'viewer');

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role member_role not null default 'recruiter',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_members_user_idx on organization_members(user_id);

create table organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email citext not null,
  role member_role not null default 'recruiter',
  token_hash text not null unique,
  invited_by uuid references users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------
create table interview_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  config jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interview_templates_org_idx on interview_templates(organization_id);

create table interview_template_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  template_id uuid not null references interview_templates(id) on delete cascade,
  name text not null,
  description text not null default '',
  objective text not null default '',
  instructions text not null default '',
  duration_minutes integer not null check (duration_minutes between 1 and 60),
  min_questions integer not null default 1 check (min_questions >= 0),
  max_questions integer not null default 3 check (max_questions >= 1),
  max_followups integer not null default 2 check (max_followups between 0 and 5),
  evaluation_criteria jsonb not null default '[]'::jsonb,
  scoring_enabled boolean not null default false,
  sort_order integer not null default 0,
  enabled boolean not null default true
);
create index interview_template_sections_template_idx on interview_template_sections(template_id, sort_order);

-- ---------------------------------------------------------------------------
-- Jobs & candidates
-- ---------------------------------------------------------------------------
create type job_status as enum ('draft', 'active', 'paused', 'closed');
create type processing_status as enum ('pending', 'processing', 'completed', 'failed');

create table jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  location text,
  employment_type text,
  experience_min integer,
  experience_max integer,
  required_skills jsonb not null default '[]'::jsonb,
  preferred_skills jsonb not null default '[]'::jsonb,
  responsibilities jsonb not null default '[]'::jsonb,
  status job_status not null default 'draft',
  parsed_requirements jsonb,
  parse_status processing_status,
  parse_error text,
  interview_template_id uuid references interview_templates(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_org_idx on jobs(organization_id, status, created_at desc);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  email citext not null,
  phone text,
  resume_file_path text,
  resume_text text,
  parsed_profile jsonb,
  parse_status processing_status,
  parse_error text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);
create index candidates_org_idx on candidates(organization_id, created_at desc);

create table candidate_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  type text not null default 'resume',
  file_name text not null,
  file_path text not null,
  mime_type text not null,
  file_size integer not null,
  extracted_text text,
  created_at timestamptz not null default now()
);
create index candidate_documents_candidate_idx on candidate_documents(candidate_id);

-- ---------------------------------------------------------------------------
-- Interviews
-- ---------------------------------------------------------------------------
create type interview_status as enum (
  'created', 'invited', 'consent_pending', 'device_check', 'ready',
  'in_progress', 'completing', 'completed', 'processing', 'report_ready',
  'cancelled', 'expired', 'failed'
);

create table interviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  template_id uuid references interview_templates(id) on delete set null,
  secure_token_hash text not null unique,
  token_expires_at timestamptz,
  status interview_status not null default 'created',
  plan_status processing_status not null default 'pending',
  plan_error text,
  current_section_index integer not null default 0,
  current_question_index integer not null default 0,
  invited_at timestamptz,
  last_reminder_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  consent_given boolean not null default false,
  consent_timestamp timestamptz,
  consent_version text,
  interview_plan jsonb,
  state jsonb not null default '{}'::jsonb,
  processing_error text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interviews_org_idx on interviews(organization_id, created_at desc);
create index interviews_job_idx on interviews(job_id);
create index interviews_candidate_idx on interviews(candidate_id);
create index interviews_status_idx on interviews(organization_id, status);

create type section_status as enum ('pending', 'in_progress', 'completed', 'skipped');

create table interview_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  interview_id uuid not null references interviews(id) on delete cascade,
  template_section_id uuid references interview_template_sections(id) on delete set null,
  sort_order integer not null,
  name text not null,
  objective text not null default '',
  status section_status not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  start_ms integer,
  end_ms integer,
  summary text,
  evaluation jsonb,
  evaluation_status processing_status,
  unique (interview_id, sort_order)
);

create table interview_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  interview_id uuid not null references interviews(id) on delete cascade,
  section_id uuid not null references interview_sections(id) on delete cascade,
  question_text text not null,
  spoken_text text not null,
  question_type text not null default 'planned',
  intent text,
  evaluation_criteria jsonb not null default '[]'::jsonb,
  plan_question_key text,
  sequence_number integer not null,
  parent_question_id uuid references interview_questions(id) on delete set null,
  is_followup boolean not null default false,
  decision jsonb,
  asked_at timestamptz not null default now(),
  asked_at_ms integer,
  unique (interview_id, sequence_number)
);
create index interview_questions_interview_idx on interview_questions(interview_id, sequence_number);

create table interview_answers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  interview_id uuid not null references interviews(id) on delete cascade,
  question_id uuid not null unique references interview_questions(id) on delete cascade,
  transcript_text text not null,
  start_ms integer,
  end_ms integer,
  duration_seconds integer,
  analysis jsonb,
  created_at timestamptz not null default now()
);

create type transcript_speaker as enum ('interviewer', 'candidate', 'system');

create table transcript_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  interview_id uuid not null references interviews(id) on delete cascade,
  section_id uuid references interview_sections(id) on delete set null,
  question_id uuid references interview_questions(id) on delete set null,
  speaker transcript_speaker not null,
  text text not null,
  start_time_ms integer not null,
  end_time_ms integer not null,
  sequence_number bigint not null,
  client_event_id text not null,
  created_at timestamptz not null default now(),
  unique (interview_id, client_event_id)
);
create index transcript_segments_interview_idx on transcript_segments(interview_id, start_time_ms);

create type recording_status as enum ('uploading', 'stored', 'failed', 'deleted');

create table recordings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  interview_id uuid not null references interviews(id) on delete cascade,
  part_index integer not null,
  offset_ms integer not null default 0,
  storage_path text not null,
  duration_seconds integer,
  file_size bigint not null default 0,
  mime_type text not null,
  status recording_status not null default 'uploading',
  chunks_received integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (interview_id, part_index)
);

create table section_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  interview_id uuid not null references interviews(id) on delete cascade,
  section_id uuid not null unique references interview_sections(id) on delete cascade,
  assessment text not null,
  score integer check (score between 1 and 5),
  summary text not null,
  strengths jsonb not null default '[]'::jsonb,
  concerns jsonb not null default '[]'::jsonb,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create table evaluation_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  evaluation_id uuid not null references section_evaluations(id) on delete cascade,
  transcript_segment_id uuid references transcript_segments(id) on delete set null,
  timestamp_start_ms integer not null,
  timestamp_end_ms integer not null,
  evidence_text text not null,
  created_at timestamptz not null default now()
);

create table interview_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  interview_id uuid not null unique references interviews(id) on delete cascade,
  status processing_status not null default 'pending',
  summary text,
  report_json jsonb,
  error text,
  attempts integer not null default 0,
  generated_at timestamptz,
  updated_at timestamptz not null default now()
);

create table interview_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  interview_id uuid not null references interviews(id) on delete cascade,
  event_id text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (interview_id, event_id)
);

-- ---------------------------------------------------------------------------
-- Platform
-- ---------------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_org_idx on notifications(organization_id, created_at desc);

create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  to_email text not null,
  subject text not null,
  body_text text not null,
  provider text not null,
  status text not null default 'sent',
  error text,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  actor_type text not null default 'user',
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_org_idx on audit_logs(organization_id, created_at desc);

create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  feature text not null,
  model text not null,
  prompt_version text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  duration_ms integer not null default 0,
  success boolean not null,
  error_code text,
  created_at timestamptz not null default now()
);
create index ai_usage_org_idx on ai_usage(organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger users_updated before update on users for each row execute function set_updated_at();
create trigger organizations_updated before update on organizations for each row execute function set_updated_at();
create trigger templates_updated before update on interview_templates for each row execute function set_updated_at();
create trigger jobs_updated before update on jobs for each row execute function set_updated_at();
create trigger candidates_updated before update on candidates for each row execute function set_updated_at();
create trigger interviews_updated before update on interviews for each row execute function set_updated_at();
create trigger recordings_updated before update on recordings for each row execute function set_updated_at();
create trigger reports_updated before update on interview_reports for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- FORCE makes policies apply to the table owner too, so the application role
-- cannot accidentally read across tenants.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organization_members', 'organization_invites', 'interview_templates',
    'interview_template_sections', 'jobs', 'candidates', 'candidate_documents',
    'interviews', 'interview_sections', 'interview_questions', 'interview_answers',
    'transcript_segments', 'recordings', 'section_evaluations', 'evaluation_evidence',
    'interview_reports', 'interview_events', 'notifications', 'email_outbox',
    'audit_logs', 'ai_usage'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (app_is_system() or organization_id = app_current_org()) '
      'with check (app_is_system() or organization_id = app_current_org())', t);
  end loop;
end $$;

alter table organizations enable row level security;
alter table organizations force row level security;
create policy tenant_isolation on organizations
  using (app_is_system() or id = app_current_org())
  with check (app_is_system() or id = app_current_org());

-- Identity tables are only ever touched from the system context.
do $$
declare t text;
begin
  foreach t in array array['users', 'sessions', 'password_resets'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy system_only on %I using (app_is_system()) with check (app_is_system())', t);
  end loop;
end $$;

-- Members may see the profile (name/email) of people in their own organization.
create policy org_member_read on users for select
  using (exists (
    select 1 from organization_members m
    where m.user_id = users.id and m.organization_id = app_current_org()
  ));
