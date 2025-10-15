-- Add video_url field to patch_notes table
ALTER TABLE patch_notes 
ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_patch_notes_video_url ON patch_notes(video_url) WHERE video_url IS NOT NULL;

-- Add comment to explain the field
COMMENT ON COLUMN patch_notes.video_url IS 'URL to the Remotion-generated video for this patch note';

