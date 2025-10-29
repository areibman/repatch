import { z } from "zod";

// Domain schema
export const AiTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const AiTemplatePayloadSchema = z.object({
  name: z.string(),
  content: z.string(),
});

// Database row schema
export const AiTemplateRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Type exports
export type AiTemplate = z.infer<typeof AiTemplateSchema>;
export type AiTemplatePayload = z.infer<typeof AiTemplatePayloadSchema>;
export type AiTemplateRow = z.infer<typeof AiTemplateRowSchema>;
