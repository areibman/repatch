# AI Templates Simplification

## Overview
Simplified AI templates from a complex multi-field structure to a simple name + markdown content model.

## What Changed

### Before
Templates had:
- name
- description
- audience (technical/non-technical/mixed)
- commitPrompt
- overallPrompt
- examples (sectionHeading, overview, commits array)

### After
Templates now have:
- name
- content (markdown document)

## Files Modified

### Database
- **New migration**: `supabase/migrations/20251020000000_simplify_ai_templates.sql`
  - Drops old table and recreates with simplified schema
  - Seeds with 2 default templates using markdown format
  - Maintains foreign key relationship with patch_notes

### Type Definitions
- **types/ai-template.ts**: Simplified to just `name` and `content` fields
- **lib/supabase/database.types.ts**: Updated to reflect new schema
- **lib/templates.ts**: Simplified helper functions

### API Routes
- **app/api/ai-templates/route.ts**: Updated validation and payload handling
- **app/api/ai-templates/[id]/route.ts**: Updated validation and payload handling
- **app/api/github/summarize/route.ts**: Updated to work with new template structure

### UI Components
- **app/settings/templates/page.tsx**: 
  - Removed all complex form fields
  - Now just name + markdown textarea
  - Displays templates as monospace code blocks
  - Fixed modal height with scrolling

- **components/create-post-dialog.tsx**:
  - Removed preview of examples, audience, etc.
  - Shows truncated markdown content preview
  - Simplified template selection

- **app/blog/[id]/page.tsx**:
  - Removed preview of examples, audience, etc.
  - Shows truncated markdown content preview
  - Simplified template selection

### AI Integration
- **lib/ai-summarizer.ts**:
  - Updated `SummaryTemplate` type to use `content` field
  - Modified prompts to embed full markdown template
  - Simplified prompt building functions

### Tests
- **tests/playwright/templates.spec.ts**: Updated mock data to use new structure

## Migration Steps

1. Run the new migration:
   ```bash
   # Apply migration to your Supabase instance
   supabase db push
   ```

2. Existing templates will be lost (backed up to `ai_templates_backup` table in migration)

3. Two default templates will be seeded:
   - Technical Deep Dive
   - Product Pulse

## Usage

Templates are now simple markdown documents that guide the AI. Example:

```markdown
# My Template

Instructions for how commits should be summarized...

## Example Summaries:
- **Feature X**: Description of what it does
```

The full markdown content is passed to the AI as context for generating patch notes.

