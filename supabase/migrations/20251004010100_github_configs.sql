-- GitHub configuration storage
CREATE TABLE IF NOT EXISTS github_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_url TEXT NOT NULL UNIQUE,
  repo_owner TEXT,
  repo_name TEXT,
  access_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_github_configs_owner_name ON github_configs(repo_owner, repo_name);

-- Trigger to keep updated_at fresh
CREATE TRIGGER update_github_configs_updated_at BEFORE UPDATE ON github_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE github_configs ENABLE ROW LEVEL SECURITY;

-- Policies (adjust for your auth model as needed)
CREATE POLICY "github_configs_read_all" ON github_configs
  FOR SELECT USING (true);
CREATE POLICY "github_configs_insert_all" ON github_configs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "github_configs_update_all" ON github_configs
  FOR UPDATE USING (true);
CREATE POLICY "github_configs_delete_all" ON github_configs
  FOR DELETE USING (true);


