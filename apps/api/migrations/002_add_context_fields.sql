-- Add context fields to assessments table for dynamic personalization
-- These fields store resume, application answers, company bio, job description, and recruiter notes

alter table assessments
  add column if not exists resume_text text,
  add column if not exists application_answers jsonb,
  add column if not exists company_bio text,
  add column if not exists job_description text,
  add column if not exists recruiter_notes text;

-- Add index for job_id lookups (if not already exists)
create index if not exists idx_assessments_job_id on assessments(job_id);

-- DOWN
-- Rollback for 002_add_context_fields.sql
drop index if exists idx_assessments_job_id;
alter table assessments
  drop column if exists recruiter_notes,
  drop column if exists job_description,
  drop column if exists company_bio,
  drop column if exists application_answers,
  drop column if exists resume_text;



