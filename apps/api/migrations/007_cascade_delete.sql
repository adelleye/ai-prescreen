-- Ensure item_events.assessment_id cascades on delete of assessments
do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints tc
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_name = 'item_events'
      and tc.constraint_name = 'item_events_assessment_id_fkey'
  ) then
    alter table item_events drop constraint item_events_assessment_id_fkey;
  end if;
end $$;

alter table item_events
  add constraint item_events_assessment_id_fkey
  foreign key (assessment_id) references assessments(id) on delete cascade;

-- Cleanup any existing orphaned rows (defensive)
delete from item_events
where assessment_id not in (select id from assessments);


