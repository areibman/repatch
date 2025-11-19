-- User Management Support
-- Pattern follows Supabase official docs for managing auth users + profile tables:
-- https://supabase.com/docs/guides/auth/managing-user-data

-- 1. Role and status enums ---------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role_type'
  ) THEN
    CREATE TYPE user_role_type AS ENUM ('owner', 'admin', 'editor', 'viewer');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_invite_status_type'
  ) THEN
    CREATE TYPE user_invite_status_type AS ENUM ('pending', 'accepted', 'expired', 'revoked');
  END IF;
END;
$$;

-- 2. Profiles table ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role user_role_type NOT NULL DEFAULT 'viewer',
  onboarding_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  preferences JSONB NOT NULL DEFAULT jsonb_build_object('newsletter_opt_in', true),
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_sign_in_at ON user_profiles(last_sign_in_at);

-- 3. Invites table -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  role user_role_type NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status user_invite_status_type NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_invites_status ON user_invites(status);
CREATE INDEX IF NOT EXISTS idx_user_invites_invited_by ON user_invites(invited_by);

-- 4. Updated-at triggers -----------------------------------------------------
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_invites_updated_at ON user_invites;
CREATE TRIGGER update_user_invites_updated_at
  BEFORE UPDATE ON user_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Profile sync + invite bookkeeping --------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  metadata jsonb;
  metadata_role text;
  resolved_role user_role_type := 'viewer'::user_role_type;
BEGIN
  metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  metadata_role := NULLIF(metadata->>'role', '');

  IF metadata_role IN ('owner', 'admin', 'editor', 'viewer') THEN
    resolved_role := metadata_role::user_role_type;
  END IF;

  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    onboarding_state,
    preferences,
    last_sign_in_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(metadata->>'full_name', metadata->>'name'),
    metadata->>'avatar_url',
    resolved_role,
    COALESCE(metadata->'onboarding_state', '{}'::jsonb),
    COALESCE(metadata->'preferences', jsonb_build_object('newsletter_opt_in', true)),
    NEW.last_sign_in_at
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
        role = EXCLUDED.role,
        onboarding_state = COALESCE(EXCLUDED.onboarding_state, user_profiles.onboarding_state),
        preferences = COALESCE(EXCLUDED.preferences, user_profiles.preferences),
        last_sign_in_at = COALESCE(EXCLUDED.last_sign_in_at, user_profiles.last_sign_in_at),
        updated_at = NOW();

  UPDATE public.user_invites
     SET status = 'accepted',
         accepted_at = NOW(),
         updated_at = NOW()
   WHERE status = 'pending'
     AND lower(email) = lower(NEW.email);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

CREATE OR REPLACE FUNCTION public.sync_user_profile_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  metadata jsonb;
BEGIN
  metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  UPDATE public.user_profiles
     SET email = NEW.email,
         full_name = COALESCE(metadata->>'full_name', metadata->>'name', user_profiles.full_name),
         avatar_url = COALESCE(metadata->>'avatar_url', user_profiles.avatar_url),
         last_sign_in_at = COALESCE(NEW.last_sign_in_at, user_profiles.last_sign_in_at),
         updated_at = NOW()
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_profile_from_auth();

-- 6. Row Level Security ------------------------------------------------------
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own profile" ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can insert own profile" ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Service role full access (profiles)" ON user_profiles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role manages invites" ON user_invites
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

