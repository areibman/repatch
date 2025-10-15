-- Email integrations table to manage provider credentials and defaults
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_provider_type') THEN
        CREATE TYPE email_provider_type AS ENUM ('resend', 'customerio');
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS email_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider email_provider_type NOT NULL,
    from_email TEXT NOT NULL,
    credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_integrations_provider_key
    ON email_integrations(provider);

CREATE UNIQUE INDEX IF NOT EXISTS email_integrations_active_idx
    ON email_integrations(is_active)
    WHERE is_active;

CREATE TRIGGER update_email_integrations_updated_at
    BEFORE UPDATE ON email_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE email_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON email_integrations
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON email_integrations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON email_integrations
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON email_integrations
    FOR DELETE USING (true);
