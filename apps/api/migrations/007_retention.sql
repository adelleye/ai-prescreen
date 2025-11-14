-- GDPR-compliant data retention function and supporting indexes
create or replace function cleanup_old_data()
returns table(rows_deleted int)
language plpgsql
as $$
declare
  _deleted_assessments int := 0;
  _deleted_links int := 0;
  _deleted_logs int := 0;
begin
  -- Delete completed assessments older than 180 days
  delete from assessments
  where created_at < now() - interval '180 days'
    and finished_at is not null;
  get diagnostics _deleted_assessments = row_count;

  -- Delete consumed magic links older than 7 days
  delete from magic_links
  where consumed_at is not null
    and consumed_at < now() - interval '7 days';
  get diagnostics _deleted_links = row_count;

  -- Delete expired unconsumed links older than 24 hours
  delete from magic_links
  where consumed_at is null
    and expires_at < now() - interval '24 hours';
  get diagnostics _deleted_links = _deleted_links + row_count;

  -- Delete audit logs older than 365 days
  delete from audit_logs
  where at < now() - interval '365 days';
  get diagnostics _deleted_logs = row_count;

  return query select (_deleted_assessments + _deleted_links + _deleted_logs)::int;
end;
$$;

-- Supporting indexes to make cleanup efficient
create index if not exists idx_assessments_created_at on assessments(created_at) where finished_at is not null;
create index if not exists idx_assessments_finished_at on assessments(finished_at);
create index if not exists idx_magic_links_expires_at on magic_links(expires_at);
create index if not exists idx_magic_links_consumed_at on magic_links(consumed_at);
create index if not exists idx_audit_logs_at on audit_logs(at);


