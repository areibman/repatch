-- Create custom types
CREATE TYPE time_period_type AS ENUM ('1day', '1week', '1month');

-- Create patch_notes table
CREATE TABLE IF NOT EXISTS patch_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_name TEXT NOT NULL,
    repo_url TEXT NOT NULL,
    time_period time_period_type NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    changes JSONB NOT NULL DEFAULT '{"added": 0, "modified": 0, "removed": 0}'::jsonb,
    contributors TEXT[] NOT NULL DEFAULT '{}',
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_patch_notes_repo_name ON patch_notes(repo_name);
CREATE INDEX idx_patch_notes_generated_at ON patch_notes(generated_at DESC);
CREATE INDEX idx_patch_notes_time_period ON patch_notes(time_period);

-- Create email_subscribers table
CREATE TABLE IF NOT EXISTS email_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX idx_email_subscribers_email ON email_subscribers(email);
CREATE INDEX idx_email_subscribers_active ON email_subscribers(active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to auto-update updated_at
CREATE TRIGGER update_patch_notes_updated_at BEFORE UPDATE ON patch_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_subscribers_updated_at BEFORE UPDATE ON email_subscribers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE patch_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;

-- Create policies (for now, allow all operations - adjust based on auth requirements)
CREATE POLICY "Enable read access for all users" ON patch_notes
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON patch_notes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON patch_notes
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON patch_notes
    FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON email_subscribers
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON email_subscribers
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON email_subscribers
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON email_subscribers
    FOR DELETE USING (true);

