-- Create jobs table for async operation tracking
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('video_render', 'ai_process', 'commit_summarize')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  metadata JSONB,
  result JSONB,
  error TEXT,
  resource_type TEXT,
  resource_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create index for querying jobs by resource
CREATE INDEX IF NOT EXISTS idx_jobs_resource ON jobs(resource_type, resource_id);

-- Create index for querying jobs by status
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- Create index for querying jobs by type
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_jobs_updated_at();

-- Add comments
COMMENT ON TABLE jobs IS 'Tracks async operations like video rendering, AI processing, etc.';
COMMENT ON COLUMN jobs.type IS 'Type of job: video_render, ai_process, commit_summarize';
COMMENT ON COLUMN jobs.status IS 'Current status: pending, running, completed, failed, cancelled';
COMMENT ON COLUMN jobs.progress IS 'Progress percentage (0-100)';
COMMENT ON COLUMN jobs.metadata IS 'Job-specific data like renderId, bucketName, etc.';
COMMENT ON COLUMN jobs.result IS 'Final result when job completes';
COMMENT ON COLUMN jobs.error IS 'Error message if job fails';
COMMENT ON COLUMN jobs.resource_type IS 'Type of resource (e.g., patch_note)';
COMMENT ON COLUMN jobs.resource_id IS 'ID of the related resource';
