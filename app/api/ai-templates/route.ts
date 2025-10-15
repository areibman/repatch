import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isValidTemplatePayload,
  serializeTemplateExamples,
  toAiTemplate,
} from "@/lib/ai-template";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ai_templates")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    const templates = (data || []).map((row) => {
      const template = toAiTemplate(row);
      return {
        ...template,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      };
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to load AI templates", error);
    return NextResponse.json(
      { error: "Failed to load AI templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
      .insert([
        {
          name: payload.name.trim(),
          description,
          audience: payload.audience.trim() || "Technical",
          commit_prompt: payload.commitPrompt,
          overall_prompt: payload.overallPrompt,
          examples: serializeTemplateExamples(payload.examples),
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    const template = toAiTemplate(data);

    return NextResponse.json(
      {
        ...template,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create AI template", error);
    return NextResponse.json(
      { error: "Failed to create AI template" },
      { status: 500 }
    );
  }
}
