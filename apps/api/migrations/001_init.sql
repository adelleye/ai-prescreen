-- Idempotent schema (Postgres)
create extension if not exists "pgcrypto";

create table if not exists magic_links (
  id uuid primary key default gen_random_uuid(),
  email_enc text not null,
  token_hash text not null unique,
  nonce text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  ip text,
  ua text
);
create index if not exists idx_magic_links_token_hash on magic_links(token_hash);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  job_id text not null,
  candidate_id uuid not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  stop_reason text,
  total_score numeric,
  integrity_band text
);

create table if not exists item_events (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id),
  item_id text not null,
  t_start timestamptz not null,
  t_end timestamptz,
  response jsonb,
  score jsonb,
  events jsonb
);
create index if not exists idx_item_events_assessment on item_events(assessment_id);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text,
  action text not null,
  entity text,
  entity_id text,
  at timestamptz not null default now(),
  ip text,
  ua text
);

-- DOWN
-- Rollback for 001_init.sql
drop table if exists audit_logs;
drop table if exists item_events;
drop table if exists assessments;
drop table if exists magic_links;


