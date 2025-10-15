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

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ai_templates")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("Failed to list AI templates", error);
    return NextResponse.json(
      { error: "Failed to load AI templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    const name = body.name?.trim();
    const commitPrompt = body.commitPrompt?.trim();
    const overallPrompt = body.overallPrompt?.trim();
    const narrativeType = body.narrativeType?.trim() || "technical";
    const description = body.description?.trim() || null;

    if (!name || !commitPrompt || !overallPrompt) {
      return NextResponse.json(
        { error: "Name, commit prompt, and overall prompt are required." },
        { status: 400 }
      );
    }

    const examples = normalizeExamples(body.examples);

    const { data, error } = await supabase
      .from("ai_templates")
      .insert([
        {
          name,
          description,
          narrative_type: narrativeType,
          commit_prompt: commitPrompt,
          overall_prompt: overallPrompt,
          examples,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Failed to create AI template", error);
    return NextResponse.json(
      { error: "Failed to create AI template" },
      { status: 500 }
    );
  }
}
