-- Create email_integrations table to store provider credentials and defaults
CREATE TABLE IF NOT EXISTS email_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT UNIQUE NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Ensure only one provider can be active at a time
CREATE UNIQUE INDEX IF NOT EXISTS email_integrations_active_unique
    ON email_integrations (is_active)
    WHERE is_active;

-- Automatically update the updated_at column
CREATE TRIGGER update_email_integrations_updated_at
    BEFORE UPDATE ON email_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS and allow full access for now
ALTER TABLE email_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON email_integrations
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON email_integrations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON email_integrations
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON email_integrations
    FOR DELETE USING (true);
