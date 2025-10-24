-- Email provider integration storage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'email_provider_type'
  ) THEN
    CREATE TYPE email_provider_type AS ENUM ('resend', 'customerio');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS email_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider email_provider_type NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_integrations_single_active
  ON email_integrations ((is_active))
  WHERE is_active = TRUE;

CREATE TRIGGER update_email_integrations_updated_at
  BEFORE UPDATE ON email_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE email_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_integrations_read_all" ON email_integrations
  FOR SELECT USING (true);

CREATE POLICY "email_integrations_insert_all" ON email_integrations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "email_integrations_update_all" ON email_integrations
  FOR UPDATE USING (true);

CREATE POLICY "email_integrations_delete_all" ON email_integrations
  FOR DELETE USING (true);
