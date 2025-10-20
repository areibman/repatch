-- Extend time_period_type enum and add filter metadata tracking
ALTER TYPE time_period_type ADD VALUE IF NOT EXISTS 'custom';
ALTER TYPE time_period_type ADD VALUE IF NOT EXISTS 'release';

ALTER TABLE patch_notes
  ADD COLUMN IF NOT EXISTS filter_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
