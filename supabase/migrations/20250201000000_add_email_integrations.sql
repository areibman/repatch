-- Create email_integrations table to manage provider configurations
CREATE TABLE IF NOT EXISTS email_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL CHECK (provider IN ('resend', 'customerio')),
    credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
    default_sender TEXT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_integrations_provider_key
    ON email_integrations(provider);

CREATE UNIQUE INDEX IF NOT EXISTS email_integrations_active_provider_idx
    ON email_integrations(is_active)
    WHERE is_active;

CREATE TRIGGER update_email_integrations_updated_at
BEFORE UPDATE ON email_integrations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE email_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON email_integrations
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON email_integrations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON email_integrations
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON email_integrations
    FOR DELETE USING (true);
