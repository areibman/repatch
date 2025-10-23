-- Store third-party email provider credentials and activation state
CREATE TABLE IF NOT EXISTS email_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL UNIQUE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Keep updated_at column accurate
CREATE TRIGGER update_email_integrations_updated_at
    BEFORE UPDATE ON email_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Ensure only one provider can be active at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_integrations_single_active
    ON email_integrations (is_active)
    WHERE is_active;

-- Enable RLS and allow basic CRUD access for now
ALTER TABLE email_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_integrations_select_all" ON email_integrations
    FOR SELECT USING (true);

CREATE POLICY "email_integrations_insert_all" ON email_integrations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "email_integrations_update_all" ON email_integrations
    FOR UPDATE USING (true);

CREATE POLICY "email_integrations_delete_all" ON email_integrations
    FOR DELETE USING (true);
