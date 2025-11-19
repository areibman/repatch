-- User management schema extensions

-- Create enum for user roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'user_role_type'
  ) THEN
    CREATE TYPE user_role_type AS ENUM ('admin', 'editor', 'viewer');
  END IF;
END;
$$;

-- Create user_profiles table synced with auth.users
CREATE TABLE IF NOT EXISTS user_profiles (
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

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);

-- Keep updated_at fresh
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_user_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_user_profiles_updated_at
      BEFORE UPDATE ON user_profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- Enforce row level security policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can view their profile'
      AND tablename = 'user_profiles'
  ) THEN
    CREATE POLICY "Users can view their profile"
      ON user_profiles
      FOR SELECT
      USING (auth.uid() = id);
  END IF;
END;
$$;

-- Allow authenticated users to update their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can update their profile'
      AND tablename = 'user_profiles'
  ) THEN
    CREATE POLICY "Users can update their profile"
      ON user_profiles
      FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END;
$$;

