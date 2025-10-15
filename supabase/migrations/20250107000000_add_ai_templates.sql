-- Create ai_templates table for customizable summarization prompts
CREATE TABLE IF NOT EXISTS ai_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    narrative_type TEXT NOT NULL DEFAULT 'technical',
    commit_prompt TEXT NOT NULL,
    overall_prompt TEXT NOT NULL,
    examples JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Ensure updated_at stays fresh
CREATE TRIGGER update_ai_templates_updated_at
    BEFORE UPDATE ON ai_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS and provide permissive policies (adjust for auth when needed)
ALTER TABLE ai_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON ai_templates
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON ai_templates
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON ai_templates
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON ai_templates
    FOR DELETE USING (true);

-- Link patch notes to an optional AI template
ALTER TABLE patch_notes
    ADD COLUMN IF NOT EXISTS ai_template_id UUID REFERENCES ai_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patch_notes_ai_template_id ON patch_notes(ai_template_id);

-- Seed default templates for both technical and non-technical narratives
INSERT INTO ai_templates (name, description, narrative_type, commit_prompt, overall_prompt, examples)
VALUES
    (
        'Technical Digest',
        'Focused on precise engineering updates and measurable impact.',
        'technical',
        $$You are an engineering newsletter assistant.
{{examples}}

Analyze the commit provided below and produce one crisp sentence (maximum 18 words) that highlights the core technical change.

Commit Message:
{{commit_message}}

Diff Preview (first 2000 characters):
{{diff}}

Additions: {{additions}}
Deletions: {{deletions}}

Write the summary in direct technical language with specific nouns and verbs. Avoid fluff and corporate tone.$$,
        $$You are preparing a technical changelog headline for the repository {{repo_name}}.
{{examples}}

Time Period: {{time_period}}
Total Commits: {{total_commits}}
Total Additions: {{total_additions}}
Total Deletions: {{total_deletions}}

Key Commit Summaries:
{{commit_summaries}}

Write 1-2 short sentences (max 30 words total) that synthesize the engineering impact. Prioritize concrete improvements and metrics when available.$$,
        '[{"title":"Refactor API client","input":"Commit touched authentication module with new token caching and diff shows added cache layer","output":"Introduced token cache in auth client to cut redundant provider requests"},{"title":"Improve build pipeline","input":"Commit message \"Optimize CI pipeline\" with diff adding parallel matrix and caching config","output":"Parallelized CI matrix and cached dependencies to shrink build times"}]'
    ),
    (
        'Leadership Brief',
        'Translates updates for executives and stakeholders who want outcomes over implementation detail.',
        'non-technical',
        $$You are drafting an update for business stakeholders.
{{examples}}

Summarize the commit below in one approachable sentence (max 20 words) that explains the user or business benefit.
Avoid jargon or code references.

Commit Message:
{{commit_message}}

Highlights from the diff (first 2000 characters):
{{diff}}

Additions: {{additions}}
Deletions: {{deletions}}$$,
        $$You are preparing an executive summary for {{repo_name}}.
{{examples}}

Period Covered: {{time_period}}
Commits Reviewed: {{total_commits}}

Key Updates:
{{commit_summaries}}

Write two sentences that share the customer-facing impact and any momentum indicators. Keep it upbeat but grounded in outcomes.$$,
        '[{"title":"Streamline onboarding","input":"Commit message \"Improve signup flow\" with diff replacing multi-step form with single screen","output":"Simplified the signup journey so new users can finish setup in one screen"},{"title":"Boost analytics","input":"Commit adds executive dashboard metrics and cleans stale reports","output":"Delivered clearer analytics so leadership can track revenue health at a glance"}]'
    )
ON CONFLICT DO NOTHING;
