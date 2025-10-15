export type AiTemplateAudience = "technical" | "non-technical" | "mixed" | string;

export interface AiTemplateExampleCommit {
  title?: string | null;
  summary: string;
}

export interface AiTemplateExamples {
  sectionHeading?: string | null;
  overview?: string | null;
  commits?: AiTemplateExampleCommit[];
}

export interface AiTemplate {
  id: string;
  name: string;
  description?: string | null;
  audience: AiTemplateAudience;
  commitPrompt: string;
  overallPrompt: string;
  examples: AiTemplateExamples;
  createdAt: string;
  updatedAt: string;
}

export interface AiTemplatePayload {
  name: string;
  description?: string | null;
  audience?: AiTemplateAudience;
  commitPrompt: string;
  overallPrompt: string;
  examples: AiTemplateExamples;
}
