-- Add video_top_changes column to patch_notes table
-- This stores manually edited top 3 changes for video generation
ALTER TABLE patch_notes
ADD COLUMN IF NOT EXISTS video_top_changes jsonb;

-- Add comment
COMMENT ON COLUMN patch_notes.video_top_changes IS 'Manually edited top 3 changes for video display: [{ title: string, description: string }]';

