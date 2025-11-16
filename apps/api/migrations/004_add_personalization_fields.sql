-- Add personalization and flexible duration fields to assessments table
-- candidate_name: Store candidate's name for personalized greeting
-- duration_minutes: Allow configurable assessment duration (default 15 minutes)

alter table assessments
  add column if not exists candidate_name text,
  add column if not exists duration_minutes int default 15;

-- Ensure duration_minutes is not null and has a valid default
update assessments set duration_minutes = 15 where duration_minutes is null;
alter table assessments alter column duration_minutes set not null;

-- DOWN
-- Rollback for 003_add_personalization_fields.sql
alter table assessments
  drop column if exists duration_minutes,
  drop column if exists candidate_name;
