-- Typefully integration tables
CREATE TABLE IF NOT EXISTS typefully_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT NOT NULL UNIQUE,
  workspace_id TEXT,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_typefully_configs_updated_at
  BEFORE UPDATE ON typefully_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE typefully_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "typefully_configs_read_all" ON typefully_configs
  FOR SELECT USING (true);
CREATE POLICY "typefully_configs_insert_all" ON typefully_configs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "typefully_configs_update_all" ON typefully_configs
  FOR UPDATE USING (true);
CREATE POLICY "typefully_configs_delete_all" ON typefully_configs
  FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS typefully_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_note_id UUID NOT NULL REFERENCES patch_notes(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  thread_id TEXT,
  queue_url TEXT,
  video_url TEXT,
  video_upload_id TEXT,
  payload JSONB,
  response JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_typefully_jobs_patch_note
  ON typefully_jobs(patch_note_id);
CREATE INDEX IF NOT EXISTS idx_typefully_jobs_status
  ON typefully_jobs(status);

CREATE TRIGGER update_typefully_jobs_updated_at
  BEFORE UPDATE ON typefully_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE typefully_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "typefully_jobs_read_all" ON typefully_jobs
  FOR SELECT USING (true);
CREATE POLICY "typefully_jobs_insert_all" ON typefully_jobs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "typefully_jobs_update_all" ON typefully_jobs
  FOR UPDATE USING (true);
CREATE POLICY "typefully_jobs_delete_all" ON typefully_jobs
  FOR DELETE USING (true);
