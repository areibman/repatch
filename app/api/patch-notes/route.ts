import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/patch-notes - Fetch all patch notes
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("patch_notes")
      .select("*")
      .order("generated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch patch notes" },
      { status: 500 }
    );
  }
}

// POST /api/patch-notes - Create a new patch note
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("patch_notes")
      .insert([
        {
          repo_name: body.repo_name,
          repo_url: body.repo_url,
          time_period: body.time_period,
          title: body.title,
          content: body.content,
          changes: body.changes,
          contributors: body.contributors,
          video_data: body.video_data,
          generated_at: body.generated_at || new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create patch note",
      },
      { status: 500 }
    );
  }
}
