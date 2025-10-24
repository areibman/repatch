-- Add content field to ai_templates table for simpler template management
ALTER TABLE ai_templates
ADD COLUMN IF NOT EXISTS content TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN ai_templates.content IS 'Simplified template content field for storing template text';

