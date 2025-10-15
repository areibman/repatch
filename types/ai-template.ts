export interface TemplateExamples {
  commitExamples: Array<{
    title: string;
    summary: string;
  }>;
  overallExample?: string;
}

export interface AiTemplate {
  id: string;
  name: string;
  description: string | null;
  audience: string;
  commitPrompt: string;
  overallPrompt: string;
  examples: TemplateExamples;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertTemplatePayload {
  name: string;
  description: string | null;
  audience: string;
  commitPrompt: string;
  overallPrompt: string;
  examples: TemplateExamples;
}

export function isTemplateExamples(value: unknown): value is TemplateExamples {
  if (!value || typeof value !== "object") {
    return false;
  }

  const { commitExamples, overallExample } = value as TemplateExamples;

  if (!Array.isArray(commitExamples)) {
    return false;
  }

  const examplesValid = commitExamples.every((example) => {
    return (
      example &&
      typeof example === "object" &&
      typeof example.title === "string" &&
      typeof example.summary === "string"
    );
  });

  if (!examplesValid) {
    return false;
  }

  if (overallExample !== undefined && typeof overallExample !== "string") {
    return false;
  }

  return true;
}
