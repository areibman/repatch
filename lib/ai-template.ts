import type { CommitSummary } from "@/lib/ai-summarizer";
import { Database, Json } from "@/lib/supabase/database.types";
import {
  AiTemplate,
  TemplateExamples,
  UpsertTemplatePayload,
  isTemplateExamples,
} from "@/types/ai-template";

export type DbAiTemplate = Database["public"]["Tables"]["ai_templates"]["Row"];

export function parseTemplateExamples(value: Json | null): TemplateExamples {
  if (value && typeof value === "object") {
    const raw = value as Record<string, unknown>;
    const commitExamples = Array.isArray(raw.commitExamples)
      ? raw.commitExamples
          .filter((example): example is { title: string; summary: string } =>
            !!example &&
            typeof example === "object" &&
            typeof (example as any).title === "string" &&
            typeof (example as any).summary === "string"
          )
          .map((example) => ({
            title: example.title,
            summary: example.summary,
          }))
      : [];

    const overallExample =
      typeof raw.overallExample === "string" ? raw.overallExample : undefined;

    return {
      commitExamples,
      overallExample,
    };
  }

  return {
    commitExamples: [],
    overallExample: undefined,
  };
}

export function serializeTemplateExamples(examples: TemplateExamples): Json {
  return {
    commitExamples: examples.commitExamples.map((example) => ({
      title: example.title,
      summary: example.summary,
    })),
    overallExample: examples.overallExample ?? "",
  };
}

export function toAiTemplate(dbTemplate: DbAiTemplate): AiTemplate {
  return {
    id: dbTemplate.id,
    name: dbTemplate.name,
    description: dbTemplate.description,
    audience: dbTemplate.audience,
    commitPrompt: dbTemplate.commit_prompt,
    overallPrompt: dbTemplate.overall_prompt,
    examples: parseTemplateExamples(dbTemplate.examples),
    createdAt: new Date(dbTemplate.created_at),
    updatedAt: new Date(dbTemplate.updated_at),
  };
}

export function fromApiTemplate(raw: any): AiTemplate {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? null,
    audience: raw.audience,
    commitPrompt: raw.commitPrompt ?? raw.commit_prompt,
    overallPrompt: raw.overallPrompt ?? raw.overall_prompt,
    examples: raw.examples ? parseTemplateExamples(raw.examples) : { commitExamples: [], overallExample: undefined },
    createdAt: new Date(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
    updatedAt: new Date(raw.updatedAt ?? raw.updated_at ?? new Date().toISOString()),
  };
}

export function isValidTemplatePayload(
  payload: unknown
): payload is UpsertTemplatePayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  const hasStrings =
    typeof candidate.name === "string" &&
    typeof candidate.commitPrompt === "string" &&
    typeof candidate.overallPrompt === "string" &&
    typeof candidate.audience === "string";

  if (!hasStrings) {
    return false;
  }

  const description = candidate.description;
  if (description !== null && description !== undefined && typeof description !== "string") {
    return false;
  }

  if (!isTemplateExamples(candidate.examples)) {
    return false;
  }

  return true;
}

export function buildPatchNoteContent(
  overallSummary: string | null,
  commitSummaries: CommitSummary[],
  template?: AiTemplate | null
): string {
  if (!overallSummary || commitSummaries.length === 0) {
    return overallSummary ?? "";
  }

  const title = template
    ? `${overallSummary}\n\n---\n\n` +
      `## ${template.name} Highlights\n\n`
    : `${overallSummary}\n\n## Key Changes\n\n`;

  const changes = commitSummaries
    .map((summary) => {
      const commitTitle = summary.message.split("\n")[0];
      return [
        `### ${commitTitle}`,
        summary.aiSummary,
        ``,
        `**Changes:** +${summary.additions} -${summary.deletions} lines`,
      ].join("\n");
    })
    .join("\n\n");

  return `${title}${changes}`;
}

export function describeTemplateForPreview(template: AiTemplate): string {
  const exampleLines = template.examples.commitExamples
    .slice(0, 2)
    .map((example) => `• ${example.title}: ${example.summary}`)
    .join("\n");

  const overallSnippet = template.examples.overallExample
    ? `Overall tone: ${template.examples.overallExample}`
    : undefined;

  return [
    `${template.audience} audience`,
    exampleLines,
    overallSnippet,
  ]
    .filter(Boolean)
    .join("\n");
}
