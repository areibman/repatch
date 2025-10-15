-- Create AI templates table for configurable summarization prompts
CREATE TABLE IF NOT EXISTS ai_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    audience TEXT NOT NULL DEFAULT 'Technical',
    commit_prompt TEXT NOT NULL,
    overall_prompt TEXT NOT NULL,
    examples JSONB NOT NULL DEFAULT '{"commitExamples": [], "overallExample": ""}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS and reuse existing timestamp trigger helper
ALTER TABLE ai_templates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_ai_templates_updated_at BEFORE UPDATE ON ai_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Enable read access for all users" ON ai_templates
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON ai_templates
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON ai_templates
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON ai_templates
    FOR DELETE USING (true);

-- Link templates to patch notes
ALTER TABLE patch_notes
    ADD COLUMN IF NOT EXISTS ai_template_id UUID REFERENCES ai_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS repo_branch TEXT NOT NULL DEFAULT 'main';

CREATE INDEX IF NOT EXISTS idx_patch_notes_ai_template_id ON patch_notes(ai_template_id);

COMMENT ON COLUMN patch_notes.ai_template_id IS 'Selected AI template used for summarization';
COMMENT ON COLUMN ai_templates.examples IS 'JSON structure containing commitExamples[] and overallExample string';
COMMENT ON COLUMN patch_notes.repo_branch IS 'Git branch that summaries were generated from';
