-- Create email_integrations table to manage outbound email providers
CREATE TABLE IF NOT EXISTS email_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL CHECK (provider IN ('resend', 'customer_io')),
    display_name TEXT,
    from_email TEXT,
    api_key TEXT,
    audience_id TEXT,
    site_id TEXT,
    track_api_key TEXT,
    transactional_message_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Ensure only one record per provider
CREATE UNIQUE INDEX IF NOT EXISTS email_integrations_provider_key
    ON email_integrations(provider);

-- Keep updated_at in sync
CREATE TRIGGER update_email_integrations_updated_at
    BEFORE UPDATE ON email_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS with permissive policies (adjust when auth is wired up)
ALTER TABLE email_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON email_integrations
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON email_integrations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON email_integrations
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON email_integrations
    FOR DELETE USING (true);
