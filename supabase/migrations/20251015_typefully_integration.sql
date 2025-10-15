-- Create table for Typefully configuration
CREATE TABLE IF NOT EXISTS typefully_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key TEXT NOT NULL,
  -- Additional configuration options for Typefully
  auto_thread BOOLEAN DEFAULT false,
  -- Default schedule options
  schedule_time TIME,
  schedule_timezone TEXT DEFAULT 'UTC',
  -- Twitter account info (cached)
  twitter_username TEXT,
  twitter_id TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for Typefully jobs queue
CREATE TABLE IF NOT EXISTS typefully_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patch_note_id UUID REFERENCES patch_notes(id) ON DELETE CASCADE,
  -- Typefully draft/post information
  typefully_draft_id TEXT,
  typefully_post_url TEXT,
  -- Thread content
  thread_content JSONB NOT NULL, -- Array of tweet texts
  video_url TEXT,
  -- Job status
  status TEXT CHECK (status IN ('pending', 'queued', 'scheduled', 'published', 'failed')) DEFAULT 'pending',
  error_message TEXT,
  -- Scheduling information
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  -- Metadata
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_typefully_jobs_status ON typefully_jobs(status);
CREATE INDEX idx_typefully_jobs_patch_note_id ON typefully_jobs(patch_note_id);
CREATE INDEX idx_typefully_jobs_scheduled_for ON typefully_jobs(scheduled_for);

-- Add RLS policies
ALTER TABLE typefully_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE typefully_jobs ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (adjust based on your auth requirements)
CREATE POLICY "Allow all operations on typefully_configs" ON typefully_configs
  FOR ALL USING (true);

CREATE POLICY "Allow all operations on typefully_jobs" ON typefully_jobs
  FOR ALL USING (true);

-- Add update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_typefully_configs_updated_at BEFORE UPDATE ON typefully_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_typefully_jobs_updated_at BEFORE UPDATE ON typefully_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();