import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isValidTemplatePayload,
  serializeTemplateExamples,
  toAiTemplate,
} from "@/lib/ai-template";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await request.json();

    if (!isValidTemplatePayload(payload)) {
      return NextResponse.json(
        { error: "Invalid template payload" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const description = payload.description?.trim() || null;

    const { data, error } = await supabase
      .from("ai_templates")
      .update({
        name: payload.name.trim(),
        description,
        audience: payload.audience.trim() || "Technical",
        commit_prompt: payload.commitPrompt,
        overall_prompt: payload.overallPrompt,
        examples: serializeTemplateExamples(payload.examples),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const template = toAiTemplate(data);

    return NextResponse.json({
      ...template,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to update AI template", error);
    return NextResponse.json(
      { error: "Failed to update AI template" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from("ai_templates")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete AI template", error);
    return NextResponse.json(
      { error: "Failed to delete AI template" },
      { status: 500 }
    );
  }
}
