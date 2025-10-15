-- Track GitHub publishing metadata on patch notes
ALTER TABLE patch_notes
  ADD COLUMN IF NOT EXISTS github_publish_target TEXT,
  ADD COLUMN IF NOT EXISTS github_publish_status TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS github_publish_error TEXT,
  ADD COLUMN IF NOT EXISTS github_release_id TEXT,
  ADD COLUMN IF NOT EXISTS github_release_url TEXT,
  ADD COLUMN IF NOT EXISTS github_release_tag TEXT,
  ADD COLUMN IF NOT EXISTS github_discussion_id TEXT,
  ADD COLUMN IF NOT EXISTS github_discussion_url TEXT,
  ADD COLUMN IF NOT EXISTS github_discussion_category_slug TEXT,
  ADD COLUMN IF NOT EXISTS github_publish_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS github_last_published_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS github_publish_next_retry_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN patch_notes.github_publish_target IS 'Target surface for GitHub publishing (release or discussion)';
COMMENT ON COLUMN patch_notes.github_publish_status IS 'State machine for GitHub publishing workflow (idle, publishing, published, failed)';
COMMENT ON COLUMN patch_notes.github_publish_error IS 'Most recent GitHub publishing error message';
COMMENT ON COLUMN patch_notes.github_publish_attempts IS 'Number of GitHub publishing attempts made for this patch note';
COMMENT ON COLUMN patch_notes.github_last_published_at IS 'Timestamp of the most recent successful GitHub publish action';
COMMENT ON COLUMN patch_notes.github_publish_next_retry_at IS 'Scheduled timestamp for the next GitHub publish retry';
