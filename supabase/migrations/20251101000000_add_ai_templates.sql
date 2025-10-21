-- Create AI templates table for customizable summarization prompts
CREATE TABLE IF NOT EXISTS ai_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    audience TEXT NOT NULL DEFAULT 'technical',
    commit_prompt TEXT NOT NULL,
    overall_prompt TEXT NOT NULL,
    examples JSONB NOT NULL DEFAULT '{"sectionHeading": "Key Changes", "overview": "", "commits": []}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Ensure updated_at stays in sync
CREATE TRIGGER update_ai_templates_updated_at
    BEFORE UPDATE ON ai_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS and allow open access for now
ALTER TABLE ai_templates ENABLE ROW LEVEL SECURITY;

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
    ADD COLUMN IF NOT EXISTS ai_template_id UUID REFERENCES ai_templates(id) ON DELETE SET NULL;

ALTER TABLE patch_notes
    ADD COLUMN IF NOT EXISTS repo_branch TEXT DEFAULT 'main';

UPDATE patch_notes
SET repo_branch = COALESCE(repo_branch, 'main');

CREATE INDEX IF NOT EXISTS idx_ai_templates_audience ON ai_templates(audience);
CREATE INDEX IF NOT EXISTS idx_patch_notes_template ON patch_notes(ai_template_id);

-- Seed default templates for technical and non-technical narratives
INSERT INTO ai_templates (name, description, audience, commit_prompt, overall_prompt, examples)
VALUES
    (
        'Technical Deep Dive',
        'Concise engineering-forward summaries that highlight architecture, performance, and tooling decisions.',
        'technical',
        'You are an engineering lead summarizing Git commits for other developers. In one punchy sentence, call out the subsystem that changed, the technical approach, and any measurable impact.',
        'You are writing the intro for an engineering changelog. In 1-2 crisp sentences, highlight the dominant technical themes and any quantified improvements.',
        '{"sectionHeading": "Engineering Highlights", "overview": "We invested the sprint into scaling critical services and tightening feedback loops.", "commits": [
          {"title": "Optimized cache hydration", "summary": "Cut Redis warmup time by batching hydration and pruning stale keys."},
          {"title": "Upgraded deployment pipeline", "summary": "Swapped bespoke scripts for reusable Nx tasks to make rollouts deterministic."}
        ]}'::jsonb
    ),
    (
        'Product Pulse',
        'Plain-language storytelling for stakeholders who care about outcomes more than implementation details.',
        'non-technical',
        'You are a product marketer recapping what customers will notice from a commit. In a friendly sentence, focus on the user-facing benefit or problem solved.',
        'You are drafting a newsletter for business stakeholders. In 1-2 approachable sentences, explain the customer value delivered this period without jargon.',
        '{"sectionHeading": "What Shipped", "overview": "Here''s what the team delivered this week to improve the experience for customers.", "commits": [
          {"title": "Streamlined onboarding", "summary": "New guided setup answers common questions so teams can start sending campaigns faster."},
          {"title": "Faster billing exports", "summary": "Finance teams can now download invoices in seconds thanks to a revamped reports page."}
        ]}'::jsonb
    )
ON CONFLICT (id) DO NOTHING;
