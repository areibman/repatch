import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mapTemplateRow } from "@/lib/templates";
import { Database } from "@/lib/supabase/database.types";
import type { AiTemplatePayload } from "@/types/ai-template";

type TemplateUpdate = Database["public"]["Tables"]["ai_templates"]["Update"];

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
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

    const supabase = await createClient();
    const update: TemplateUpdate = {
      name: payload.name.trim(),
      content: payload.content.trim(),
    };

    const { data, error } = await supabase
      .from("ai_templates")
      .update(update)
      .eq("id", id)
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
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from("ai_templates")
      .delete()
      .eq("id", id);

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
}
