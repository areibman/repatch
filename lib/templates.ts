import type { Database } from "@/lib/supabase/database.types";
import type { AiTemplate } from "@/types/ai-template";

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
