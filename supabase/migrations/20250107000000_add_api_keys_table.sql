-- Create table to manage external API keys
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    token_prefix TEXT NOT NULL,
    token_last_four TEXT NOT NULL,
    hashed_token TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_used_at TIMESTAMP WITH TIME ZONE,
    rotated_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Ensure lookups on hashed token and prefix remain fast and unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hashed_token ON api_keys(hashed_token);
CREATE INDEX IF NOT EXISTS idx_api_keys_token_prefix ON api_keys(token_prefix);

-- Automatically update the updated_at timestamp
CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS and restrict access to trusted server contexts
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role to manage API keys"
    ON api_keys
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

