-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE time_period_type AS ENUM ('1day', '1week', '1month', 'custom', 'release');
CREATE TYPE processing_status_type AS ENUM ('pending', 'fetching_stats', 'analyzing_commits', 'generating_content', 'generating_video', 'completed', 'failed');
CREATE TYPE user_role_type AS ENUM ('owner', 'admin', 'editor', 'viewer');
CREATE TYPE user_status_type AS ENUM ('invited', 'active', 'suspended', 'deactivated');

-- Create ai_templates table
CREATE TABLE ai_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    content TEXT,
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
    processing_status processing_status_type DEFAULT 'pending',
    processing_stage TEXT,
    processing_error TEXT,
    processing_progress INTEGER CHECK (processing_progress >= 0 AND processing_progress <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_patch_notes_generated_at ON patch_notes(generated_at);
CREATE INDEX idx_patch_notes_repo_name ON patch_notes(repo_name);
CREATE INDEX idx_patch_notes_time_period ON patch_notes(time_period);
CREATE INDEX idx_patch_notes_processing_status ON patch_notes(processing_status);
CREATE INDEX idx_patch_notes_video_render_id ON patch_notes(video_render_id) WHERE video_render_id IS NOT NULL;

-- Create user_profiles table to mirror Supabase Auth users
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role user_role_type NOT NULL DEFAULT 'viewer',
    status user_status_type NOT NULL DEFAULT 'invited',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_sign_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for user profiles
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_status ON user_profiles(status);

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
CREATE POLICY "Allow all access" ON ai_templates FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE patch_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON patch_notes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);


