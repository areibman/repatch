-- Add ai_detailed_contexts column to patch_notes table
ALTER TABLE patch_notes
ADD COLUMN IF NOT EXISTS ai_detailed_contexts jsonb;

-- Add comment
COMMENT ON COLUMN patch_notes.ai_detailed_contexts IS 'Detailed internal technical summaries (Step 1) fed into final changelog generation';

