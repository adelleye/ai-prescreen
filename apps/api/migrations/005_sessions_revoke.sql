-- Add revoked_at column to sessions and related helpers
alter table if not exists sessions
  add column if not exists revoked_at timestamptz;

create index if not exists idx_sessions_revoked_at on sessions(revoked_at);

-- No DOWN migration necessary for forward-only migrations


