-- Add GitHub publishing metadata fields to patch_notes table
ALTER TABLE patch_notes
  ADD COLUMN IF NOT EXISTS github_release_id TEXT,
  ADD COLUMN IF NOT EXISTS github_release_url TEXT,
  ADD COLUMN IF NOT EXISTS github_discussion_id TEXT,
  ADD COLUMN IF NOT EXISTS github_discussion_url TEXT,
  ADD COLUMN IF NOT EXISTS github_publish_status TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS github_publish_target TEXT,
  ADD COLUMN IF NOT EXISTS github_publish_error TEXT,
  ADD COLUMN IF NOT EXISTS github_publish_attempted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS github_publish_completed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_patch_notes_github_publish_status
  ON patch_notes (github_publish_status);

COMMENT ON COLUMN patch_notes.github_release_id IS 'Identifier of the GitHub release created for this patch note';
COMMENT ON COLUMN patch_notes.github_release_url IS 'HTML URL for the GitHub release created for this patch note';
COMMENT ON COLUMN patch_notes.github_discussion_id IS 'Identifier of the GitHub discussion created for this patch note';
COMMENT ON COLUMN patch_notes.github_discussion_url IS 'HTML URL for the GitHub discussion created for this patch note';
COMMENT ON COLUMN patch_notes.github_publish_status IS 'State of the latest GitHub publish attempt: idle, publishing, published, failed';
COMMENT ON COLUMN patch_notes.github_publish_target IS 'Target selected for the most recent GitHub publish attempt (release or discussion)';
COMMENT ON COLUMN patch_notes.github_publish_error IS 'Last error message returned when publishing to GitHub failed';
COMMENT ON COLUMN patch_notes.github_publish_attempted_at IS 'Timestamp for the most recent GitHub publish attempt';
COMMENT ON COLUMN patch_notes.github_publish_completed_at IS 'Timestamp for the last successful GitHub publish completion';
