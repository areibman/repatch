-- Typefully integration schema

-- Job status enum
DO $$ BEGIN
  CREATE TYPE typefully_job_status AS ENUM ('queued', 'processing', 'succeeded', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Store Typefully configuration (single-row for now)
CREATE TABLE IF NOT EXISTS typefully_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT NOT NULL,
  profile_id TEXT NOT NULL, -- Typefully profile identifier (account)
  team_id TEXT,             -- Optional team/workspace id
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Keep updated_at fresh
CREATE TRIGGER update_typefully_configs_updated_at BEFORE UPDATE ON typefully_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enforce a single config row (adjust later for multi-tenant)
CREATE UNIQUE INDEX IF NOT EXISTS uq_typefully_configs_singleton ON typefully_configs ((true));

-- Jobs table to track queue attempts
CREATE TABLE IF NOT EXISTS typefully_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_note_id UUID NOT NULL REFERENCES patch_notes(id) ON DELETE CASCADE,
  status typefully_job_status NOT NULL DEFAULT 'queued',
  thread_id TEXT,              -- Returned by Typefully
  video_url TEXT,              -- The video URL used in the thread (if any)
  error TEXT,                  -- Error message when failed
  request_payload JSONB,       -- What we attempted to send
  response_payload JSONB,      -- Response from Typefully
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_typefully_jobs_patch_note ON typefully_jobs(patch_note_id);
CREATE INDEX IF NOT EXISTS idx_typefully_jobs_status ON typefully_jobs(status);

CREATE TRIGGER update_typefully_jobs_updated_at BEFORE UPDATE ON typefully_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE typefully_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE typefully_jobs ENABLE ROW LEVEL SECURITY;

-- Policies (liberal for demo; tighten when auth added)
CREATE POLICY typefully_configs_read_all ON typefully_configs FOR SELECT USING (true);
CREATE POLICY typefully_configs_insert_all ON typefully_configs FOR INSERT WITH CHECK (true);
CREATE POLICY typefully_configs_update_all ON typefully_configs FOR UPDATE USING (true);
CREATE POLICY typefully_configs_delete_all ON typefully_configs FOR DELETE USING (true);

CREATE POLICY typefully_jobs_read_all ON typefully_jobs FOR SELECT USING (true);
CREATE POLICY typefully_jobs_insert_all ON typefully_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY typefully_jobs_update_all ON typefully_jobs FOR UPDATE USING (true);
CREATE POLICY typefully_jobs_delete_all ON typefully_jobs FOR DELETE USING (true);
