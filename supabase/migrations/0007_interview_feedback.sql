-- Candidate feedback and issue reports, submitted from the thank-you page
-- after an interview. Tenant data: visible to the interview's organization.
create table interview_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  interview_id uuid not null references interviews(id) on delete cascade,
  kind text not null check (kind in ('feedback', 'issue')),
  rating smallint check (rating between 1 and 5),
  category text,
  message text check (char_length(message) <= 2000),
  created_at timestamptz not null default now(),
  check (kind = 'issue' or rating is not null),
  check (kind = 'feedback' or category is not null)
);
create index interview_feedback_interview_idx on interview_feedback(interview_id, created_at);

alter table interview_feedback enable row level security;
alter table interview_feedback force row level security;
create policy tenant_isolation on interview_feedback
  using (app_is_system() or organization_id = app_current_org())
  with check (app_is_system() or organization_id = app_current_org());
