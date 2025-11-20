import type { Database } from "@/lib/supabase/database.types";
import type { AiTemplate } from "@/types/ai-template";

export interface TemplateSeed {
  readonly name: string;
  readonly content: string;
}

export const DEFAULT_AI_TEMPLATES: readonly TemplateSeed[] = [
  {
    name: "Detailed Patch",
    content: `# Detailed Patch Template

v{{version}} — {{tagline}}

## Overview
- Summarize what changed in two sentences.
- Example: We now combine a semantic index with a custom browser stack for the most comprehensive web data API.

## New Features
1. **{{feature_name}}** — Describe the outcome in one line.
   - Example: Implemented scraping for .xlsx (Excel) files so analysts can ingest structured exports without manual cleanup.
2. **{{feature_name}}** — Outline why it matters.
   - Example: Introduced NUQ concurrency tracking plus per-owner/group limits to eliminate noisy throttling.

## Enhancements & Improvements
- Capture quality-of-life wins or platform polish.
  - Example: Improved blocklist loading, unsupported site errors, and includePaths handling for subdomains.
  - Example: Updated SDK defaults (JS, Python, Rust) so self-hosted deployments skip API key requirements and use tracing by default.

## Fixes
- Note the critical bugs that were resolved.
  - Example: Surface crawl robots.txt warnings reliably and prevent concurrency deadlocks or duplicate job handling.
  - Example: Patch search pricing defaults, viewport dimension handling, and CI flakiness.

## Contributors
- Shout out everyone involved (e.g., @delong3, @c4nc, @codetheweb) and note first-time contributors.

## Links
- Full diff: {{previous_tag}}...{{current_tag}}
- Optional: highlight 2–3 notable PRs with a short explanation.`,
  },
  {
    name: "Single Tweet",
    content: `# Single Tweet Template

{{productname}} {{version}} ({{nickname}}) is out!

- Lead with the headline feature or theme.
  - Example: Tons of new integrations (OpenAI Assistants, Grok, TaskWeaver, Smolagents, SwarmZero).
- Add one supporting improvement.
  - Example: Nearly full migration to uv plus new documentation walkthrough videos.
- Mention stability or bug fixes when relevant.
  - Example: Lots of bug fixes and contributions from @cognition_labs + Devin.

Huge thanks to {{contributors}} and the OSS community that made this patch possible.

Link: {{release_link}}`,
  },
];

export function mapTemplateRow(
  row: Database["public"]["Tables"]["ai_templates"]["Row"]
): AiTemplate {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
