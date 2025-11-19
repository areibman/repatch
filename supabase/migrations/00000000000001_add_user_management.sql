-- Migration: Add user management support
-- This migration adds user profiles and updates tables to be user-aware

-- ============================================================================
-- 1. Create profiles table that links to auth.users
-- ============================================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies: Users can read their own profile, only owner can update
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Apply updated_at trigger to profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. Add user_id columns to existing tables
-- ============================================================================

-- Add user_id to ai_templates
ALTER TABLE ai_templates
    ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to patch_notes
ALTER TABLE patch_notes
    ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes for user_id columns
CREATE INDEX idx_ai_templates_user_id ON ai_templates(user_id);
CREATE INDEX idx_patch_notes_user_id ON patch_notes(user_id);

-- ============================================================================
-- 3. Update RLS policies to be user-aware
-- ============================================================================

-- Drop old permissive policies
DROP POLICY IF EXISTS "Allow all access" ON ai_templates;
DROP POLICY IF EXISTS "Allow all access" ON patch_notes;

-- AI Templates policies
CREATE POLICY "Users can view their own templates"
    ON ai_templates FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates"
    ON ai_templates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
    ON ai_templates FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
    ON ai_templates FOR DELETE
    USING (auth.uid() = user_id);

-- Patch Notes policies
CREATE POLICY "Users can view their own patch notes"
    ON patch_notes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patch notes"
    ON patch_notes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patch notes"
    ON patch_notes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patch notes"
    ON patch_notes FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 4. Create function to handle new user signup
-- ============================================================================

-- Function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call handle_new_user when a user signs up
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 5. Grant necessary permissions
-- ============================================================================

-- Grant access to profiles table
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- ============================================================================
-- 6. Add helper function to get current user's profile
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS SETOF profiles AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM profiles
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
