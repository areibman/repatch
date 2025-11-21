import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withApiAuth } from "@/lib/api/with-auth";
import { DEFAULT_AI_TEMPLATES, mapTemplateRow } from "@/lib/templates";
import type { AiTemplatePayload } from "@/types/ai-template";
import type { Database } from "@/lib/supabase/database.types";

const TEMPLATE_COLUMNS =
  "id, name, content, owner_id, created_at, updated_at";

function selectTemplates(
  supabase: SupabaseClient<Database>
) {
  return supabase
    .from("ai_templates")
    .select(TEMPLATE_COLUMNS)
    .order("name", { ascending: true });
}

async function seedTemplatesForUser(
  supabase: SupabaseClient<Database>,
  ownerId: string
): Promise<boolean> {
  try {
    if (!ownerId) {
      return false;
    }

    const payload = DEFAULT_AI_TEMPLATES.map((template) => ({
      name: template.name,
      content: template.content,
      owner_id: ownerId,
    }));

    const { error } = await supabase.from("ai_templates").insert(payload);

    if (error) {
      console.warn("[API] Templates: Failed to seed defaults", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[API] Templates: Unexpected seeding error", error);
    return false;
  }
}

export async function GET() {
  return withApiAuth(
    async ({ supabase, auth }) => {
      const start = Date.now();
      const authType = auth.token ? `token:${auth.token.prefix}` : "session";
      console.log(
        `[API][templates] user=${auth.user.id} via=${authType} fetching templates`
      );

      let { data, error } = await selectTemplates(supabase);

      if (error) {
        console.error("[API][templates] query failed:", error);
        return NextResponse.json(
          { error: "Failed to load templates" },
          { status: 500 }
        );
      }

      let templates = data ?? [];

      if (templates.length === 0) {
        const seeded = await seedTemplatesForUser(supabase, auth.user.id);
        console.log(
          `[API][templates] user=${auth.user.id} seededDefaults=${seeded}`
        );

        if (seeded) {
          const refreshResult = await selectTemplates(supabase);
          error = refreshResult.error;
          templates = refreshResult.data ?? [];

          if (error) {
            console.error(
              "[API][templates] refresh after seeding failed:",
              error
            );
            return NextResponse.json(
              { error: "Failed to load templates" },
              { status: 500 }
            );
          }
        }
      }

      console.log(
        `[API][templates] user=${auth.user.id} returning ${templates.length} templates in ${Date.now() - start}ms`
      );

      return NextResponse.json(templates.map(mapTemplateRow));
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
