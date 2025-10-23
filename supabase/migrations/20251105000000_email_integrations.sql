-- Email integrations table to manage provider credentials and defaults
CREATE TABLE IF NOT EXISTS email_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Keep updated_at current
CREATE TRIGGER update_email_integrations_updated_at
    BEFORE UPDATE ON email_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE email_integrations ENABLE ROW LEVEL SECURITY;

-- Allow open access for now (adjust when auth is added)
CREATE POLICY "email_integrations_read" ON email_integrations
    FOR SELECT USING (true);
CREATE POLICY "email_integrations_write" ON email_integrations
    FOR ALL USING (true) WITH CHECK (true);

-- Ensure there is always at least a Resend row for backwards compatibility
INSERT INTO email_integrations (provider, is_active, settings)
VALUES ('resend', TRUE, '{}'::jsonb)
ON CONFLICT (provider) DO NOTHING;
