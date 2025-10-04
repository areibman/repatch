-- Add video_data column to patch_notes table
ALTER TABLE patch_notes 
ADD COLUMN video_data JSONB;

-- Add comment to describe the column
COMMENT ON COLUMN patch_notes.video_data IS 'JSON data for video generation containing langCode, topChanges, and allChanges';
