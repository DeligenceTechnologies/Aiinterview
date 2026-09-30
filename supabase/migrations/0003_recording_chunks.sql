-- Recordings are kept as the ordered chunks the browser uploaded and streamed
-- back in order. This avoids assembling large files (storage providers cap
-- single-object size, e.g. 50 MB on Supabase free) and makes finishing instant.
create table recording_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  recording_id uuid not null references recordings(id) on delete cascade,
  chunk_index integer not null,
  storage_path text not null,
  size integer not null,
  created_at timestamptz not null default now(),
  unique (recording_id, chunk_index)
);

alter table recording_chunks enable row level security;
alter table recording_chunks force row level security;
create policy tenant_isolation on recording_chunks
  using (app_is_system() or organization_id = app_current_org())
  with check (app_is_system() or organization_id = app_current_org());
