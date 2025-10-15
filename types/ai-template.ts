export interface AiTemplate {
  id: string;
  name: string;
  description: string | null;
  audience: "technical" | "non-technical" | "balanced";
  commitPrompt: string;
  overallPrompt: string;
  exampleInput: string | null;
  exampleOutput: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AiTemplateDraft = Omit<
  AiTemplate,
  "id" | "createdAt" | "updatedAt"
> & { id?: string };
