-- Add processing status tracking to patch_notes
CREATE TYPE processing_status_type AS ENUM ('pending', 'fetching_stats', 'analyzing_commits', 'generating_content', 'generating_video', 'completed', 'failed');

ALTER TABLE patch_notes 
ADD COLUMN processing_status processing_status_type DEFAULT 'completed',
ADD COLUMN processing_stage TEXT,
ADD COLUMN processing_error TEXT;

-- Add index for querying by status
CREATE INDEX idx_patch_notes_processing_status ON patch_notes(processing_status);

-- Allow null content for pending posts
ALTER TABLE patch_notes ALTER COLUMN content DROP NOT NULL;
ALTER TABLE patch_notes ALTER COLUMN changes SET DEFAULT '{"added": 0, "modified": 0, "removed": 0}'::jsonb;

