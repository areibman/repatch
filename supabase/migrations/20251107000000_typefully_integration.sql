-- Typefully integration tables
CREATE TABLE IF NOT EXISTS typefully_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT NOT NULL UNIQUE,
  workspace_id TEXT,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS typefully_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_note_id UUID NOT NULL REFERENCES patch_notes(id) ON DELETE CASCADE,
  typefully_config_id UUID NOT NULL REFERENCES typefully_configs(id) ON DELETE CASCADE,
  thread_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  video_url TEXT,
  payload JSONB,
  response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_typefully_jobs_patch_note ON typefully_jobs(patch_note_id DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_typefully_jobs_thread ON typefully_jobs(thread_id);

CREATE TRIGGER update_typefully_configs_updated_at BEFORE UPDATE ON typefully_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_typefully_jobs_updated_at BEFORE UPDATE ON typefully_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE typefully_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE typefully_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "typefully_configs_read_all" ON typefully_configs
  FOR SELECT USING (true);
CREATE POLICY "typefully_configs_insert_all" ON typefully_configs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "typefully_configs_update_all" ON typefully_configs
  FOR UPDATE USING (true);
CREATE POLICY "typefully_configs_delete_all" ON typefully_configs
  FOR DELETE USING (true);

CREATE POLICY "typefully_jobs_read_all" ON typefully_jobs
  FOR SELECT USING (true);
CREATE POLICY "typefully_jobs_insert_all" ON typefully_jobs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "typefully_jobs_update_all" ON typefully_jobs
  FOR UPDATE USING (true);
CREATE POLICY "typefully_jobs_delete_all" ON typefully_jobs
  FOR DELETE USING (true);
