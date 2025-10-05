-- Add AI summary fields to patch_notes table
ALTER TABLE patch_notes 
ADD COLUMN IF NOT EXISTS ai_summaries JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ai_overall_summary TEXT DEFAULT NULL;

-- Add index for faster queries on AI summaries
CREATE INDEX IF NOT EXISTS idx_patch_notes_ai_summaries ON patch_notes USING GIN (ai_summaries);

-- Add comment to explain the structure
COMMENT ON COLUMN patch_notes.ai_summaries IS 'Array of AI-generated summaries for significant commits: [{sha, message, aiSummary, additions, deletions}]';
COMMENT ON COLUMN patch_notes.ai_overall_summary IS 'AI-generated overall summary of all changes in the patch note';

