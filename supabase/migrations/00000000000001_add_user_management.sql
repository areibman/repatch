-- Migration: Add User Management Support
-- Description: Implements Supabase Auth integration with profiles table and user-scoped RLS policies
-- Based on: https://supabase.com/docs/guides/auth

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
-- Create a public profiles table that references auth.users
-- This follows Supabase's recommended pattern for user profile management
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles table
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================================================
-- AUTOMATIC PROFILE CREATION
-- ============================================================================
-- Create a trigger function that automatically creates a profile entry
-- when a new user signs up via Supabase Auth
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

-- Trigger the function every time a user is created in auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- UPDATE EXISTING TABLES WITH USER OWNERSHIP
-- ============================================================================

-- Add user_id column to ai_templates
ALTER TABLE public.ai_templates
    ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add index for faster user-scoped queries
CREATE INDEX idx_ai_templates_user_id ON public.ai_templates(user_id);

-- Add user_id column to patch_notes
ALTER TABLE public.patch_notes
    ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add index for faster user-scoped queries
CREATE INDEX idx_patch_notes_user_id ON public.patch_notes(user_id);

-- ============================================================================
-- UPDATE RLS POLICIES FOR EXISTING TABLES
-- ============================================================================

-- Drop the old "Allow all access" policies
DROP POLICY IF EXISTS "Allow all access" ON public.ai_templates;
DROP POLICY IF EXISTS "Allow all access" ON public.patch_notes;

-- AI Templates: User-scoped RLS policies
CREATE POLICY "Users can view own templates"
    ON public.ai_templates
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own templates"
    ON public.ai_templates
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
    ON public.ai_templates
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
    ON public.ai_templates
    FOR DELETE
    USING (auth.uid() = user_id);

-- Patch Notes: User-scoped RLS policies
CREATE POLICY "Users can view own patch notes"
    ON public.patch_notes
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own patch notes"
    ON public.patch_notes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patch notes"
    ON public.patch_notes
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own patch notes"
    ON public.patch_notes
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get the current user's profile
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.email, p.full_name, p.avatar_url, p.created_at, p.updated_at
    FROM public.profiles p
    WHERE p.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply updated_at trigger to profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- NOTES
-- ============================================================================
-- This migration adds user management support following Supabase best practices:
-- 1. Profiles table references auth.users for user metadata
-- 2. Automatic profile creation via trigger on user signup
-- 3. User-scoped RLS policies for multi-tenancy
-- 4. Existing tables (ai_templates, patch_notes) now support user ownership
-- 5. All data is isolated per user via RLS policies
--
-- IMPORTANT: Existing data will have NULL user_id values.
-- You may need to either:
-- - Delete existing data: DELETE FROM ai_templates; DELETE FROM patch_notes;
-- - Or assign to a default user: UPDATE ai_templates SET user_id = 'user-uuid';
