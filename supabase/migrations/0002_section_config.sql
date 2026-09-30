-- Snapshot of the template section configuration at interview creation time,
-- so later template edits never change how an existing interview runs.
alter table interview_sections add column config jsonb not null default '{}'::jsonb;
