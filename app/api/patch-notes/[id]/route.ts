import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, type Database } from "@/lib/supabase";
import { cookies } from "next/headers";

type PatchNoteUpdate = Database["public"]["Tables"]["patch_notes"]["Update"];

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// GET /api/patch-notes/[id] - Fetch a single patch note
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    const { data, error } = await supabase
      .from("patch_notes")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch patch note" },
      { status: 500 }
    );
  }
}

// PUT /api/patch-notes/[id] - Update a patch note
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    const body = await request.json();

    const updateData: PatchNoteUpdate = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.repo_name !== undefined) updateData.repo_name = body.repo_name;
    if (body.repo_url !== undefined) updateData.repo_url = body.repo_url;
    if (body.repo_branch !== undefined)
      updateData.repo_branch = body.repo_branch;
    if (body.time_period !== undefined)
      updateData.time_period = body.time_period;
    if (body.changes !== undefined) updateData.changes = body.changes;
    if (body.contributors !== undefined)
      updateData.contributors = body.contributors;
    if (body.video_data !== undefined) updateData.video_data = body.video_data;
    if (body.ai_summaries !== undefined)
      updateData.ai_summaries = body.ai_summaries;
    if (body.ai_overall_summary !== undefined)
      updateData.ai_overall_summary = body.ai_overall_summary;
    if (body.ai_detailed_contexts !== undefined)
      updateData.ai_detailed_contexts = body.ai_detailed_contexts;
    if (body.ai_template_id !== undefined)
      updateData.ai_template_id = body.ai_template_id;
    if (body.filter_metadata !== undefined)
      updateData.filter_metadata = body.filter_metadata;
    if (body.video_top_changes !== undefined)
      updateData.video_top_changes = body.video_top_changes;

    const { data, error } = await supabase
      .from("patch_notes")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update patch note" },
      { status: 500 }
    );
  }
}

// DELETE /api/patch-notes/[id] - Delete a patch note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    const { error } = await supabase.from("patch_notes").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete patch note" },
      { status: 500 }
    );
  }
}
