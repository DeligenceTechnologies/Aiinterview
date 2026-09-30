-- Public job applications with AI screening.
alter table jobs add column apply_enabled boolean not null default false;
alter table jobs add column apply_slug text unique;

create type application_status as enum ('new', 'shortlisted', 'interview_invited', 'declined');

create table job_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  status application_status not null default 'new',
  source text not null default 'public_link',
  linkedin_url text,
  cover_note text,
  consent_given boolean not null default false,
  consent_timestamp timestamptz,
  screening_status processing_status not null default 'pending',
  screening jsonb,
  match_level text,
  requirements_met integer,
  requirements_total integer,
  screening_error text,
  interview_id uuid references interviews(id) on delete set null,
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);
create index job_applications_job_idx on job_applications(job_id, created_at desc);
create trigger job_applications_updated before update on job_applications for each row execute function set_updated_at();

alter table job_applications enable row level security;
alter table job_applications force row level security;
create policy tenant_isolation on job_applications
  using (app_is_system() or organization_id = app_current_org())
  with check (app_is_system() or organization_id = app_current_org());
