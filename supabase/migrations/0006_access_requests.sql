-- Access requests from the public home page. Not tenant data: only the
-- server (system context) can read or write it; reviewed directly in Supabase.
create table access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email citext not null,
  company text not null,
  team_size text,
  phone text,
  message text,
  status text not null default 'new',
  source text not null default 'home_page',
  created_at timestamptz not null default now()
);
create index access_requests_created_idx on access_requests(created_at desc);

alter table access_requests enable row level security;
alter table access_requests force row level security;
create policy system_only on access_requests using (app_is_system()) with check (app_is_system());
