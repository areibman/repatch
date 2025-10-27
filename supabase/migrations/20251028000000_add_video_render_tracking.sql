-- Add video render tracking columns to patch_notes table
-- These columns store the Remotion Lambda render job information for polling

ALTER TABLE patch_notes 
ADD COLUMN IF NOT EXISTS video_render_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS video_bucket_name TEXT DEFAULT NULL;

-- Add index for faster lookups when checking render status
CREATE INDEX IF NOT EXISTS idx_patch_notes_video_render_id 
ON patch_notes(video_render_id) 
WHERE video_render_id IS NOT NULL;

-- Add comments to explain the fields
COMMENT ON COLUMN patch_notes.video_render_id IS 'Remotion Lambda render ID for tracking video generation progress';
COMMENT ON COLUMN patch_notes.video_bucket_name IS 'S3 bucket name where the video render is being processed';

