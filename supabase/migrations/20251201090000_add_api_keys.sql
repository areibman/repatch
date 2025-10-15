-- Create api_keys table to manage external API access
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    prefix TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    rotated_from UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Ensure prefix uniqueness for quick lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked_at ON api_keys(revoked_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_last_used_at ON api_keys(last_used_at);

-- Reuse existing trigger to maintain updated_at column
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS and allow basic operations (tighten when auth is in place)
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON api_keys
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON api_keys
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON api_keys
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON api_keys
    FOR DELETE USING (true);
