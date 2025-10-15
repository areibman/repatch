import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TemplateExample } from "@/types/ai-template";

function normalizeExamples(examples: unknown): TemplateExample[] {
  if (!Array.isArray(examples)) {
    return [];
  }

  return examples
    .filter(
      (example): example is TemplateExample =>
        typeof example === "object" &&
        example !== null &&
        typeof (example as TemplateExample).title === "string" &&
        typeof (example as TemplateExample).input === "string" &&
        typeof (example as TemplateExample).output === "string"
    )
    .map((example) => ({
      title: example.title,
      input: example.input,
      output: example.output,
    }));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.description !== undefined)
      updates.description = body.description ? String(body.description).trim() : null;
    if (body.narrativeType !== undefined)
      updates.narrative_type = String(body.narrativeType).trim();
    if (body.commitPrompt !== undefined)
      updates.commit_prompt = String(body.commitPrompt).trim();
    if (body.overallPrompt !== undefined)
      updates.overall_prompt = String(body.overallPrompt).trim();
    if (body.examples !== undefined)
      updates.examples = normalizeExamples(body.examples);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("ai_templates")
      // @ts-expect-error - Supabase typing does not like dynamic keys
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
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

    const { error } = await supabase.from("ai_templates").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
