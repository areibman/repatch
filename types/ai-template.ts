export interface TemplateExample {
  title: string;
  input: string;
  output: string;
}

export interface AiTemplate {
  id: string;
  name: string;
  description: string | null;
  narrativeType: string;
  commitPrompt: string;
  overallPrompt: string;
  examples: TemplateExample[];
  createdAt: string;
  updatedAt: string;
}

export type UpsertAiTemplatePayload = {
  name: string;
  description?: string;
  narrativeType: string;
  commitPrompt: string;
  overallPrompt: string;
  examples: TemplateExample[];
};
