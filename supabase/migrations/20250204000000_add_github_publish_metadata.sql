-- GitHub publishing metadata for patch notes
ALTER TABLE patch_notes
  ADD COLUMN github_publish_status TEXT NOT NULL DEFAULT 'idle' CHECK (github_publish_status IN ('idle', 'publishing', 'succeeded', 'failed')),
  ADD COLUMN github_publish_error TEXT,
  ADD COLUMN github_release_id TEXT,
  ADD COLUMN github_release_url TEXT,
  ADD COLUMN github_discussion_id TEXT,
  ADD COLUMN github_discussion_url TEXT,
  ADD COLUMN github_published_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN patch_notes.github_publish_status IS 'Current status of GitHub publishing workflow (idle, publishing, succeeded, failed).';
COMMENT ON COLUMN patch_notes.github_publish_error IS 'Last error message from GitHub publishing attempts.';
COMMENT ON COLUMN patch_notes.github_release_id IS 'Identifier of the GitHub release created for this patch note.';
COMMENT ON COLUMN patch_notes.github_release_url IS 'HTML URL of the GitHub release created for this patch note.';
COMMENT ON COLUMN patch_notes.github_discussion_id IS 'Identifier of the GitHub discussion created for this patch note.';
COMMENT ON COLUMN patch_notes.github_discussion_url IS 'HTML URL of the GitHub discussion created for this patch note.';
COMMENT ON COLUMN patch_notes.github_published_at IS 'Timestamp when the patch note was published to GitHub.';
