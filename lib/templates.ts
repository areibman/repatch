import type { Database } from "@/lib/supabase/database.types";
import type { AiTemplate, AiTemplateExamples } from "@/types/ai-template";

export const DEFAULT_TEMPLATE_EXAMPLES: AiTemplateExamples = {
  sectionHeading: "Key Changes",
  overview:
    "AI highlights the most meaningful updates with a confident, stakeholder-ready tone.",
  commits: [
    {
      title: "Performance lift",
      summary: "Improved API latency with smarter caching and batched writes.",
    },
    {
      title: "Product polish",
      summary: "Refined onboarding copy so first-time users understand setup steps faster.",
    },
  ],
};

export function normalizeTemplateExamples(
  examples?:
    | AiTemplateExamples
    | Database["public"]["Tables"]["ai_templates"]["Row"]["examples"]
    | null
): AiTemplateExamples {
  return {
    sectionHeading: examples?.sectionHeading || DEFAULT_TEMPLATE_EXAMPLES.sectionHeading,
    overview: examples?.overview || "",
    commits: (examples?.commits || []).filter((commit) => commit.summary?.trim()),
  };
}

export function mapTemplateRow(
  row: Database["public"]["Tables"]["ai_templates"]["Row"]
): AiTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    audience: row.audience,
    commitPrompt: row.commit_prompt,
    overallPrompt: row.overall_prompt,
    examples: normalizeTemplateExamples(row.examples),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function formatTemplateAudience(
  audience?: string | null
): string {
  if (!audience) {
    return 'technical';
  }

  return audience.replace(/-/g, ' ');
}
