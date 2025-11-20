-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE time_period_type AS ENUM ('1day', '1week', '1month', 'custom', 'release');
CREATE TYPE processing_status_type AS ENUM ('pending', 'fetching_stats', 'analyzing_commits', 'generating_content', 'generating_video', 'completed', 'failed');
CREATE TYPE user_role_type AS ENUM ('admin', 'editor', 'viewer');

-- Create ai_templates table
CREATE TABLE ai_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    content TEXT,
    owner_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create patch_notes table
CREATE TABLE patch_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repo_name TEXT NOT NULL,
    repo_url TEXT NOT NULL,
    repo_branch TEXT DEFAULT 'main',
    time_period time_period_type NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    title TEXT NOT NULL,
    content TEXT,
    changes JSONB NOT NULL DEFAULT '{"added": 0, "modified": 0, "removed": 0}'::jsonb,
    contributors TEXT[] DEFAULT '{}',
    filter_metadata JSONB,
    video_data JSONB,
    video_top_changes JSONB,
    video_url TEXT,
    video_render_id TEXT,
    video_bucket_name TEXT,
    ai_summaries JSONB,
    ai_overall_summary TEXT,
    ai_detailed_contexts JSONB,
    ai_template_id UUID REFERENCES ai_templates(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    processing_status processing_status_type DEFAULT 'pending',
    processing_stage TEXT,
    processing_error TEXT,
    processing_progress INTEGER CHECK (processing_progress >= 0 AND processing_progress <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role user_role_type NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create api_tokens table
CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE api_tokens
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Create indexes
CREATE INDEX idx_patch_notes_generated_at ON patch_notes(generated_at);
CREATE INDEX idx_patch_notes_repo_name ON patch_notes(repo_name);
CREATE INDEX idx_patch_notes_time_period ON patch_notes(time_period);
CREATE INDEX idx_patch_notes_processing_status ON patch_notes(processing_status);
CREATE INDEX idx_patch_notes_video_render_id ON patch_notes(video_render_id) WHERE video_render_id IS NOT NULL;
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_is_active ON user_profiles(is_active);
CREATE UNIQUE INDEX idx_api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX idx_api_tokens_user_id ON api_tokens(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_ai_templates_updated_at
    BEFORE UPDATE ON ai_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patch_notes_updated_at
    BEFORE UPDATE ON patch_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE ai_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE patch_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies: ai_templates
CREATE POLICY "Users can read own ai_templates"
  ON ai_templates FOR SELECT
  USING (owner_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can insert own ai_templates"
  ON ai_templates FOR INSERT
  WITH CHECK (owner_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can update own ai_templates"
  ON ai_templates FOR UPDATE
  USING (owner_id = auth.uid() OR auth.role() = 'service_role')
  WITH CHECK (owner_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can delete own ai_templates"
  ON ai_templates FOR DELETE
  USING (owner_id = auth.uid() OR auth.role() = 'service_role');

-- RLS Policies: patch_notes
CREATE POLICY "Users can read own patch_notes"
  ON patch_notes FOR SELECT
  USING (owner_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can insert own patch_notes"
  ON patch_notes FOR INSERT
  WITH CHECK (owner_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can update own patch_notes"
  ON patch_notes FOR UPDATE
  USING (owner_id = auth.uid() OR auth.role() = 'service_role')
  WITH CHECK (owner_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can delete own patch_notes"
  ON patch_notes FOR DELETE
  USING (owner_id = auth.uid() OR auth.role() = 'service_role');

-- RLS Policies: user_profiles
CREATE POLICY "Users can view their profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies: api_tokens
CREATE POLICY "Users can read their tokens"
  ON api_tokens FOR SELECT
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can create their tokens"
  ON api_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can update their tokens"
  ON api_tokens FOR UPDATE
  USING (user_id = auth.uid() OR auth.role() = 'service_role')
  WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can delete their tokens"
  ON api_tokens FOR DELETE
  USING (user_id = auth.uid() OR auth.role() = 'service_role');
