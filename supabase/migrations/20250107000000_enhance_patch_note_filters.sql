-- Extend time period enum and capture filter metadata
ALTER TYPE time_period_type ADD VALUE IF NOT EXISTS 'custom';
ALTER TYPE time_period_type ADD VALUE IF NOT EXISTS 'release';

ALTER TABLE patch_notes
  ADD COLUMN IF NOT EXISTS filters JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN patch_notes.filters IS 'Metadata describing the filters used for the patch note generation (date range, tags, releases).';

CREATE INDEX IF NOT EXISTS idx_patch_notes_filters ON patch_notes USING GIN (filters);
