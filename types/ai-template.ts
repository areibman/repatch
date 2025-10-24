export interface AiTemplate {
  id: string;
  name: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiTemplatePayload {
  name: string;
  content: string;
}
