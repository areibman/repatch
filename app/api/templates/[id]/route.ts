import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/lib/supabase/database.types";

type TemplateUpdate = Database["public"]["Tables"]["ai_templates"]["Update"];

type TemplateRow = Database["public"]["Tables"]["ai_templates"]["Row"];

function mapTemplateRow(template: TemplateRow) {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    audience: template.audience,
    commitPrompt: template.commit_prompt,
    overallPrompt: template.overall_prompt,
    exampleInput: template.example_input,
    exampleOutput: template.example_output,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ai_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(mapTemplateRow(data));
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();

    const update: TemplateUpdate = {};

    if (body.name !== undefined) update.name = body.name;
    if (body.description !== undefined) update.description = body.description;
    if (body.audience !== undefined) update.audience = body.audience;
    if (body.commitPrompt !== undefined)
      update.commit_prompt = body.commitPrompt;
    if (body.overallPrompt !== undefined)
      update.overall_prompt = body.overallPrompt;
    if (body.exampleInput !== undefined)
      update.example_input = body.exampleInput;
    if (body.exampleOutput !== undefined)
      update.example_output = body.exampleOutput;

    if (
      update.audience &&
      !["technical", "non-technical", "balanced"].includes(update.audience)
    ) {
      return NextResponse.json(
        { error: "Invalid audience value" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("ai_templates")
      // @ts-expect-error -- Supabase types struggle with partial updates
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapTemplateRow(data));
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update template" },
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
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
