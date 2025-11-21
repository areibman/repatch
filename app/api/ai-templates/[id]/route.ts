import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api/with-auth";
import type { Database } from "@/lib/supabase";
import { mapTemplateRow } from "@/lib/templates";
import type { AiTemplatePayload } from "@/types/ai-template";

type TemplateUpdate = Database["public"]["Tables"]["ai_templates"]["Update"];

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  return withApiAuth(async ({ supabase, auth }) => {
    try {
      const { id } = await params;
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

      const update: TemplateUpdate = {
        name: payload.name.trim(),
        content: payload.content.trim(),
      };

      const { data, error } = await supabase
        .from("ai_templates")
        .update(update)
        .eq("id", id)
        .eq("owner_id", auth.user.id)
        .select("*")
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message || "Failed to update template" },
          { status: 500 }
        );
      }

      return NextResponse.json(mapTemplateRow(data));
    } catch (error) {
      console.error("Error updating template:", error);
      return NextResponse.json(
        { error: "Failed to update template" },
        { status: 500 }
      );
    }
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return withApiAuth(async ({ supabase, auth }) => {
    try {
      const { id } = await params;

      const { error } = await supabase
        .from("ai_templates")
        .delete()
        .eq("id", id)
        .eq("owner_id", auth.user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting template:", error);
      return NextResponse.json(
        { error: "Failed to delete template" },
        { status: 500 }
      );
    }
  });
}
