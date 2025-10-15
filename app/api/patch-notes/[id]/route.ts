import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/lib/supabase/database.types";

const isMock = process.env.REPATCH_TEST_MODE === "mock";

type PatchNoteUpdate = Database["public"]["Tables"]["patch_notes"]["Update"];

// GET /api/patch-notes/[id] - Fetch a single patch note
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (isMock) {
      const { getPatchNoteById } = await import("@/lib/testing/mockStore");
      const note = getPatchNoteById(id);
      if (!note) {
        return NextResponse.json({ error: "Patch note not found" }, { status: 404 });
      }
      return NextResponse.json(note);
    }
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("patch_notes")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(data);
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
    const body = await request.json();

    if (isMock) {
      const { updatePatchNote } = await import("@/lib/testing/mockStore");
      const updated = updatePatchNote(id, body);
      if (!updated) {
        return NextResponse.json({ error: "Patch note not found" }, { status: 404 });
      }
      return NextResponse.json(updated);
    }

    const supabase = await createClient();

    const updateData: PatchNoteUpdate = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.repo_name !== undefined) updateData.repo_name = body.repo_name;
    if (body.repo_url !== undefined) updateData.repo_url = body.repo_url;
    if (body.time_period !== undefined)
      updateData.time_period = body.time_period;
    if (body.changes !== undefined) updateData.changes = body.changes;
    if (body.contributors !== undefined)
      updateData.contributors = body.contributors;
    if (body.video_data !== undefined) updateData.video_data = body.video_data;

    const { data, error } = await supabase
      .from("patch_notes")
      // @ts-expect-error - Supabase type inference issue with partial updates
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
    if (isMock) {
      const { deletePatchNote } = await import("@/lib/testing/mockStore");
      const deleted = deletePatchNote(id);
      if (!deleted) {
        return NextResponse.json({ error: "Patch note not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }
    const supabase = await createClient();

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
