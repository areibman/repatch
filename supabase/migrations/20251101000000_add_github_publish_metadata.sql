-- Track GitHub publishing metadata on patch notes
ALTER TABLE patch_notes
  ADD COLUMN IF NOT EXISTS github_release_id BIGINT,
  ADD COLUMN IF NOT EXISTS github_release_url TEXT,
  ADD COLUMN IF NOT EXISTS github_discussion_id BIGINT,
  ADD COLUMN IF NOT EXISTS github_discussion_url TEXT,
  ADD COLUMN IF NOT EXISTS github_publish_status TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS github_publish_target TEXT,
  ADD COLUMN IF NOT EXISTS github_publish_error TEXT,
  ADD COLUMN IF NOT EXISTS github_published_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN patch_notes.github_release_id IS 'Numeric identifier for the GitHub release created for this patch note.';
COMMENT ON COLUMN patch_notes.github_release_url IS 'HTML URL for the GitHub release created for this patch note.';
COMMENT ON COLUMN patch_notes.github_discussion_id IS 'Numeric identifier for the GitHub discussion created for this patch note.';
COMMENT ON COLUMN patch_notes.github_discussion_url IS 'HTML URL for the GitHub discussion created for this patch note.';
COMMENT ON COLUMN patch_notes.github_publish_status IS 'Latest GitHub publishing status: idle, pending, published, partial, or failed.';
COMMENT ON COLUMN patch_notes.github_publish_target IS 'Most recent GitHub publishing target: release, discussion, or both.';
COMMENT ON COLUMN patch_notes.github_publish_error IS 'Last GitHub publishing error message if publishing failed.';
COMMENT ON COLUMN patch_notes.github_published_at IS 'Timestamp when the patch note was last published to GitHub.';
