-- Data fixes below must see every tenant's rows.
select set_config('app.system', 'on', true);

-- Per-person notification state: reading or clearing a notification affects
-- only the person who did it, not the whole team.
create table notification_states (
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  read_at timestamptz,
  dismissed_at timestamptz,
  primary key (notification_id, user_id)
);
create index notification_states_user_idx on notification_states(user_id);

alter table notification_states enable row level security;
alter table notification_states force row level security;
create policy tenant_isolation on notification_states
  using (app_is_system() or organization_id = app_current_org())
  with check (app_is_system() or organization_id = app_current_org());

-- Carry over the old team-wide "read" flag to every member.
insert into notification_states (notification_id, user_id, organization_id, read_at)
select n.id, m.user_id, n.organization_id, n.read_at
from notifications n join organization_members m on m.organization_id = n.organization_id
where n.read_at is not null and (n.user_id is null or n.user_id = m.user_id)
on conflict do nothing;

-- Link applications to interviews created outside the application page.
-- Recruiter decisions (declined) are kept; only new/shortlisted move on.
with matches as (
  select a.id as application_id,
    (select i.id from interviews i
     where i.job_id = a.job_id and i.candidate_id = a.candidate_id and i.status not in ('cancelled', 'expired', 'failed')
     order by i.created_at desc limit 1) as interview_id
  from job_applications a
  where a.interview_id is null
)
update job_applications a
set interview_id = m.interview_id,
    status = case when a.status in ('new', 'shortlisted') then 'interview_invited'::application_status else a.status end
from matches m
where a.id = m.application_id and m.interview_id is not null;
