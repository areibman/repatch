-- User management schema derived from Supabase Auth patterns:
-- https://supabase.com/docs/guides/auth/managing-users

-- Enums for RBAC + lifecycle state
CREATE TYPE user_role_type AS ENUM ('admin', 'manager', 'editor', 'viewer', 'service');
CREATE TYPE user_status_type AS ENUM ('invited', 'active', 'suspended', 'deactivated');

-- Primary profile table that mirrors auth.users and stores RBAC metadata
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role user_role_type NOT NULL DEFAULT 'viewer',
    status user_status_type NOT NULL DEFAULT 'invited',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_sign_in_at TIMESTAMPTZ,
    email_confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- API tokens for MCP / automation integrations.
-- Only hashed tokens are stored – raw tokens returned once via API.
CREATE TABLE user_api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    hashed_token TEXT NOT NULL CHECK (char_length(hashed_token) = 64),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_user_api_tokens_hashed_token ON user_api_tokens (hashed_token);
CREATE INDEX idx_user_api_tokens_user_id ON user_api_tokens (user_id);

-- Lightweight audit trail for user changes
CREATE TABLE user_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL,
    actor_id UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    reason TEXT,
    previous_values JSONB,
    new_values JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_audit_logs_user_id ON user_audit_logs (user_id);
CREATE INDEX idx_user_audit_logs_actor_id ON user_audit_logs (actor_id);

-- Keep profile rows in sync with auth.users lifecycle events
CREATE OR REPLACE FUNCTION public.handle_auth_user_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_profiles (
        user_id,
        email,
        full_name,
        avatar_url,
        status,
        metadata,
        email_confirmed_at,
        last_sign_in_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'avatar'),
        CASE
            WHEN NEW.deleted_at IS NOT NULL THEN 'deactivated'::user_status_type
            WHEN NEW.confirmed_at IS NOT NULL THEN 'active'::user_status_type
            ELSE 'invited'::user_status_type
        END,
        COALESCE(NEW.raw_user_meta_data, '{}'::jsonb),
        NEW.confirmed_at,
        NEW.last_sign_in_at
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata,
        email_confirmed_at = EXCLUDED.email_confirmed_at,
        last_sign_in_at = EXCLUDED.last_sign_in_at,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_change();

CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_change();

-- Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users-own-profile-read" ON user_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "users-own-profile-update" ON user_profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users-own-profile-insert" ON user_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service-role-full-access" ON user_profiles
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

ALTER TABLE user_api_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users-own-tokens-read" ON user_api_tokens
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "users-own-tokens-insert" ON user_api_tokens
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users-own-tokens-delete" ON user_api_tokens
    FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "service-role-token-access" ON user_api_tokens
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

ALTER TABLE user_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit-service-role-only" ON user_audit_logs
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

GRANT ALL ON TABLE user_profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE user_api_tokens TO authenticated, service_role;
GRANT ALL ON TABLE user_audit_logs TO service_role;

