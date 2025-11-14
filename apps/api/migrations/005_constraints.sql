-- Add UNIQUE constraint to prevent duplicate submissions per item per assessment
create unique index if not exists idx_item_events_assessment_item
on item_events(assessment_id, item_id);

-- No DOWN section for forward-only migrations


