-- Simplify AI templates to just name and content (markdown)
-- This migration replaces the complex structure with a simple markdown document

-- First, backup existing data to a temporary table (optional, but safe)
CREATE TABLE IF NOT EXISTS ai_templates_backup AS SELECT * FROM ai_templates;

-- Drop the existing table and recreate it with the new simplified structure
DROP TABLE IF EXISTS ai_templates CASCADE;

CREATE TABLE ai_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Re-create the trigger for updated_at
CREATE TRIGGER update_ai_templates_updated_at
    BEFORE UPDATE ON ai_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS and allow open access
ALTER TABLE ai_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON ai_templates
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON ai_templates
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON ai_templates
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON ai_templates
    FOR DELETE USING (true);

-- Re-add the foreign key to patch_notes (it was dropped with CASCADE)
ALTER TABLE patch_notes
    ADD COLUMN IF NOT EXISTS ai_template_id UUID REFERENCES ai_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patch_notes_template ON patch_notes(ai_template_id);

-- Seed with default templates using markdown format
INSERT INTO ai_templates (name, content)
VALUES
    (
        'Technical Deep Dive',
        '# Technical Deep Dive Template

This template is designed for engineering-focused audiences who care about implementation details, architecture decisions, and measurable performance improvements.

## Commit Summary Instructions

For each commit, write one punchy sentence that highlights:
- The subsystem or component that changed
- The technical approach taken
- Any measurable impact (performance, reliability, etc.)

### Example Commit Summaries:
- **Optimized cache hydration**: Cut Redis warmup time by batching hydration and pruning stale keys.
- **Upgraded deployment pipeline**: Swapped bespoke scripts for reusable Nx tasks to make rollouts deterministic.

## Overall Summary Instructions

For the opening paragraph, write 1-2 crisp sentences that:
- Highlight the dominant technical themes
- Call out any quantified improvements
- Maintain an engineering-forward tone

### Example Opening:
We invested the sprint into scaling critical services and tightening feedback loops, cutting API latency by 30% and reducing deploy time from 12 minutes to under 5.
'
    ),
    (
        'Product Pulse',
        '# Product Pulse Template

This template is tailored for non-technical stakeholders who care about user-facing outcomes and business value rather than implementation details.

## Commit Summary Instructions

For each commit, write a friendly sentence that focuses on:
- What customers will notice or experience
- The user-facing benefit or problem solved
- Plain language without technical jargon

### Example Commit Summaries:
- **Streamlined onboarding**: New guided setup answers common questions so teams can start sending campaigns faster.
- **Faster billing exports**: Finance teams can now download invoices in seconds thanks to a revamped reports page.

## Overall Summary Instructions

For the opening paragraph, write 1-2 approachable sentences that:
- Explain the customer value delivered
- Avoid technical jargon
- Focus on outcomes and benefits

### Example Opening:
Here''s what the team delivered this week to improve the experience for customers. We made it easier to get started and faster to access the data you need.
'
    )
ON CONFLICT (id) DO NOTHING;

