-- Add sessions table for session-based authorization
-- Sessions are created after magic link consumption and link candidates to their assessments

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ip text,
  ua text
);

create index if not exists idx_sessions_assessment_id on sessions(assessment_id);
create index if not exists idx_sessions_expires_at on sessions(expires_at);

-- Add function to clean up expired sessions (can be called periodically)
create or replace function cleanup_expired_sessions()
returns void as $$
begin
  delete from sessions where expires_at < now();
end;
$$ language plpgsql;

-- DOWN
-- Rollback for 003_add_sessions.sql
drop function if exists cleanup_expired_sessions();
drop index if exists idx_sessions_expires_at;
drop index if exists idx_sessions_assessment_id;
drop table if exists sessions;
