-- Automatically provision user_profiles rows whenever a Supabase auth user
-- is created directly through the public auth APIs or an OAuth provider.

DROP TRIGGER IF EXISTS handle_new_user_profile_trigger ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_profile();

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  metadata JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    is_active,
    metadata,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(TRIM(COALESCE(metadata->> 'full_name', '')), ''),
    NULLIF(TRIM(COALESCE(metadata->> 'avatar_url', '')), ''),
    'viewer',
    TRUE,
    metadata,
    NEW.last_sign_in_at,
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.created_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

  RETURN NEW;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER handle_new_user_profile_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();


