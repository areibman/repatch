-- Extend time_period_type enum to support custom filters and release selections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'time_period_type'::regtype
      AND enumlabel = 'custom'
  ) THEN
    ALTER TYPE time_period_type ADD VALUE 'custom';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'time_period_type'::regtype
      AND enumlabel = 'release'
  ) THEN
    ALTER TYPE time_period_type ADD VALUE 'release';
  END IF;
END$$;

-- Track the filter metadata used to generate each patch note
ALTER TABLE patch_notes
  ADD COLUMN IF NOT EXISTS filter_metadata JSONB;

COMMENT ON COLUMN patch_notes.filter_metadata IS 'Selected filters used when generating the patch note.';

CREATE INDEX IF NOT EXISTS idx_patch_notes_filter_metadata
  ON patch_notes USING GIN (filter_metadata);
