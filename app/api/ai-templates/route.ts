import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withApiAuth } from "@/lib/api/with-auth";
import { DEFAULT_AI_TEMPLATES, mapTemplateRow } from "@/lib/templates";
import type { AiTemplatePayload } from "@/types/ai-template";
import type { Database } from "@/lib/supabase/database.types";

const TEMPLATE_COLUMNS =
  "id, name, content, owner_id, created_at, updated_at";

type TemplateRow = Database["public"]["Tables"]["ai_templates"]["Row"];

const DEFAULT_TEMPLATE_NAMES = new Set(
  DEFAULT_AI_TEMPLATES.map((template) => template.name.toLowerCase())
);

function getTemplateTimestamp(template: TemplateRow): number {
  const timestamp = template.updated_at || template.created_at;
  return timestamp ? new Date(timestamp).getTime() : 0;
}

async function pruneDefaultTemplateDuplicates(
  supabase: SupabaseClient<Database>,
  templates: TemplateRow[]
): Promise<boolean> {
  const duplicates: string[] = [];

  const grouped = new Map<string, TemplateRow[]>();
  for (const template of templates) {
    const key = template.name?.toLowerCase();
    if (!key || !DEFAULT_TEMPLATE_NAMES.has(key)) {
      continue;
    }

    const list = grouped.get(key) ?? [];
    list.push(template);
    grouped.set(key, list);
  }

  grouped.forEach((list) => {
    if (list.length <= 1) {
      return;
    }

    list
      .sort((a, b) => getTemplateTimestamp(b) - getTemplateTimestamp(a))
      .slice(1)
      .forEach((template) => duplicates.push(template.id));
  });

  if (duplicates.length === 0) {
    return false;
  }

  const { error } = await supabase
    .from("ai_templates")
    .delete()
    .in("id", duplicates);

  if (error) {
    console.warn("[API] Templates: Failed to prune duplicates", error.message);
    return false;
  }

  return true;
}

async function syncDefaultTemplatesForUser(
  supabase: SupabaseClient<Database>,
  ownerId: string | undefined,
  templates: TemplateRow[]
): Promise<boolean> {
  if (!ownerId) {
    return false;
  }

  const existingDefaultNames = new Set(
    templates
      .map((template) => template.name?.toLowerCase() ?? "")
      .filter((name) => DEFAULT_TEMPLATE_NAMES.has(name))
  );

  const payload = DEFAULT_AI_TEMPLATES.filter(
    (template) => !existingDefaultNames.has(template.name.toLowerCase())
  ).map((template) => ({
    name: template.name,
    content: template.content,
    owner_id: ownerId,
  }));

  if (payload.length === 0) {
    return false;
  }

  const { error } = await supabase.from("ai_templates").insert(payload);

  if (error) {
    console.warn("[API] Templates: Failed to seed defaults", error.message);
    return false;
  }

  return true;
}

function sortTemplates(templates: TemplateRow[]): TemplateRow[] {
  return [...templates].sort((a, b) => a.name.localeCompare(b.name));
}

async function refetchTemplates(supabase: SupabaseClient<Database>) {
  return supabase
    .from("ai_templates")
    .select(TEMPLATE_COLUMNS)
    .order("name", { ascending: true });
}

export async function GET() {
  const start = Date.now();
  console.log("[API] Fetching templates started");

  return withApiAuth(
    async ({ supabase, auth }) => {
      try {
        const initialResult = await refetchTemplates(supabase);

        if (initialResult.error) {
          return NextResponse.json(
            { error: initialResult.error.message },
            { status: 500 }
          );
        }

        let templates = initialResult.data ?? [];

        const refreshTemplates = async () => {
          const refreshResult = await refetchTemplates(supabase);
          if (refreshResult.error) {
            throw new Error(refreshResult.error.message);
          }
          return refreshResult.data ?? [];
        };

        const duplicatesRemoved = await pruneDefaultTemplateDuplicates(
          supabase,
          templates
        );

        if (duplicatesRemoved) {
          templates = await refreshTemplates();
        }

        const seeded = await syncDefaultTemplatesForUser(
          supabase,
          auth.user.id,
          templates
        );

        if (seeded) {
          templates = await refreshTemplates();
        }

        const sortedTemplates = sortTemplates(templates);
        console.log(
          `[API] Templates completed in ${Date.now() - start}ms`
        );
        return NextResponse.json(sortedTemplates.map(mapTemplateRow));
      } catch (error) {
        console.error("Error fetching templates:", error);
        return NextResponse.json(
          { error: "Failed to load templates" },
          { status: 500 }
        );
      }
    },
    { skipProfile: true }
  );
}

export async function POST(request: NextRequest) {
  return withApiAuth(async ({ supabase, auth }) => {
    try {
      const payload = (await request.json()) as AiTemplatePayload;

      if (!payload.name?.trim()) {
        return NextResponse.json(
          { error: "Template name is required" },
          { status: 400 }
        );
      }

      if (!payload.content?.trim()) {
        return NextResponse.json(
          { error: "Template content is required" },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("ai_templates")
        .insert({
          name: payload.name.trim(),
          content: payload.content.trim(),
          owner_id: auth.user.id,
        })
        .select("*")
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message || "Failed to create template" },
          { status: 500 }
        );
      }

      return NextResponse.json(mapTemplateRow(data), { status: 201 });
    } catch (error) {
      console.error("Error creating template:", error);
      return NextResponse.json(
        { error: "Failed to create template" },
        { status: 500 }
      );
    }
  });
}
