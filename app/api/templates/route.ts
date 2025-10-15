import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/lib/supabase/database.types";

type TemplateInsert = Database["public"]["Tables"]["ai_templates"]["Insert"];

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

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ai_templates")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data.map(mapTemplateRow));
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    const payload: TemplateInsert = {
      name: body.name,
      description: body.description ?? null,
      audience: body.audience ?? "balanced",
      commit_prompt: body.commitPrompt,
      overall_prompt: body.overallPrompt,
      example_input: body.exampleInput ?? null,
      example_output: body.exampleOutput ?? null,
    };

    if (!payload.name || !payload.commit_prompt || !payload.overall_prompt) {
      return NextResponse.json(
        { error: "name, commitPrompt, and overallPrompt are required" },
        { status: 400 }
      );
    }

    if (
      payload.audience &&
      !["technical", "non-technical", "balanced"].includes(payload.audience)
    ) {
      return NextResponse.json(
        { error: "Invalid audience value" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("ai_templates")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapTemplateRow(data), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
