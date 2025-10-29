import type { Database } from "@/lib/supabase/database.types";
import {
  AiTemplateSchema,
  AiTemplateRowSchema,
  type AiTemplate,
  type AiTemplateRow,
} from "@/lib/schemas/ai-template.schema";

type DatabaseRow = Database["public"]["Tables"]["ai_templates"]["Row"];

/**
 * Validates and converts a database row to domain type
 * Throws ZodError if validation fails
 */
export function mapAiTemplateRowToDomain(row: DatabaseRow): AiTemplate {
  // Validate the raw database row structure
  const validatedRow = AiTemplateRowSchema.parse(row);

  // Map to domain format
  const domain: AiTemplate = {
    id: validatedRow.id,
    name: validatedRow.name,
    content: validatedRow.content || null,
    createdAt: validatedRow.created_at,
    updatedAt: validatedRow.updated_at,
  };

  // Final validation of domain object
  return AiTemplateSchema.parse(domain);
}

/**
 * Converts domain type to database insert format
 */
export function mapAiTemplateDomainToInsert(
  domain: Partial<AiTemplate>
): Database["public"]["Tables"]["ai_templates"]["Insert"] {
  return {
    name: domain.name!,
    content: domain.content ?? "",
  };
}

/**
 * Converts domain type to database update format
 */
export function mapAiTemplateDomainToUpdate(
  domain: Partial<AiTemplate>
): Database["public"]["Tables"]["ai_templates"]["Update"] {
  const update: Database["public"]["Tables"]["ai_templates"]["Update"] = {};

  if (domain.name !== undefined) update.name = domain.name;
  if (domain.content !== undefined) update.content = domain.content ?? "";

  return update;
}

/**
 * Safely validates and converts a database row, returning a result object
 */
export function safeMapAiTemplateRowToDomain(
  row: DatabaseRow
): { success: true; data: AiTemplate } | { success: false; error: unknown } {
  try {
    const data = mapAiTemplateRowToDomain(row);
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
}
