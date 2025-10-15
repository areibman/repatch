import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mapTemplateRow, normalizeTemplateExamples } from "@/lib/templates";
import type { AiTemplatePayload } from "@/types/ai-template";

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

    return NextResponse.json((data || []).map(mapTemplateRow));
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to load templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as AiTemplatePayload;

    if (!payload.name?.trim()) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    if (!payload.commitPrompt?.trim() || !payload.overallPrompt?.trim()) {
      return NextResponse.json(
        { error: "Both commitPrompt and overallPrompt are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ai_templates")
      .insert({
        name: payload.name.trim(),
        description: payload.description?.trim() || null,
        audience: payload.audience || "technical",
        commit_prompt: payload.commitPrompt,
        overall_prompt: payload.overallPrompt,
        examples: normalizeTemplateExamples(payload.examples),
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
}
