-- Add custom time period support and filter metadata for patch note generation
ALTER TYPE time_period_type ADD VALUE IF NOT EXISTS 'custom';

ALTER TABLE patch_notes
  ADD COLUMN IF NOT EXISTS filter_metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN patch_notes.filter_metadata IS 'Serialized generation filters (date ranges, tags, releases) used to create the patch note';
