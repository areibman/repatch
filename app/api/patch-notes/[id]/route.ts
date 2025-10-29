import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import {
  safeMapPatchNoteRowToDomain,
  mapPatchNoteDomainToUpdate,
} from "@/lib/mappers";
import { ProcessingStatusSchema } from "@/lib/schemas/patch-note.schema";

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

    if (!data) {
      return NextResponse.json({ error: "Patch note not found" }, { status: 404 });
    }

    // Validate and map to domain type
    const mappedResult = safeMapPatchNoteRowToDomain(data);
    if (!mappedResult.success) {
      console.error("Failed to validate patch note:", mappedResult.error);
      return NextResponse.json(
        { error: "Invalid patch note data" },
        { status: 500 }
      );
    }

    return NextResponse.json(mappedResult.data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("API error:", error);
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

    // Build domain update object from request body
    const domainUpdate: Partial<{
      title: string;
      content: string;
      repoName: string;
      repoUrl: string;
      repoBranch: string | null;
      timePeriod: string;
      changes: Record<string, unknown>;
      contributors: string[];
      videoData: Record<string, unknown> | null;
      aiSummaries: unknown[] | null;
      aiOverallSummary: string | null;
      aiDetailedContexts: unknown[] | null;
      aiTemplateId: string | null;
      filterMetadata: Record<string, unknown> | null;
      videoTopChanges: unknown[] | null;
      processingStatus: string | null;
    }> = {};

    // Map request body to domain format (camelCase to domain format)
    if (body.title !== undefined) domainUpdate.title = body.title;
    if (body.content !== undefined) domainUpdate.content = body.content;
    if (body.repo_name !== undefined) domainUpdate.repoName = body.repo_name;
    if (body.repo_url !== undefined) domainUpdate.repoUrl = body.repo_url;
    if (body.repo_branch !== undefined)
      domainUpdate.repoBranch = body.repo_branch;
    if (body.time_period !== undefined)
      domainUpdate.timePeriod = body.time_period;
    if (body.changes !== undefined) domainUpdate.changes = body.changes;
    if (body.contributors !== undefined)
      domainUpdate.contributors = body.contributors;
    if (body.video_data !== undefined) domainUpdate.videoData = body.video_data;
    if (body.ai_summaries !== undefined)
      domainUpdate.aiSummaries = body.ai_summaries;
    if (body.ai_overall_summary !== undefined)
      domainUpdate.aiOverallSummary = body.ai_overall_summary;
    if (body.ai_detailed_contexts !== undefined)
      domainUpdate.aiDetailedContexts = body.ai_detailed_contexts;
    if (body.ai_template_id !== undefined)
      domainUpdate.aiTemplateId = body.ai_template_id;
    if (body.filter_metadata !== undefined)
      domainUpdate.filterMetadata = body.filter_metadata;
    if (body.video_top_changes !== undefined)
      domainUpdate.videoTopChanges = body.video_top_changes;
    // Validate processing_status if provided
    if (body.processing_status !== undefined) {
      domainUpdate.processingStatus = ProcessingStatusSchema.parse(body.processing_status);
    }

    // Convert domain update to database format
    const updateData = mapPatchNoteDomainToUpdate(domainUpdate);

    const { data, error } = await supabase
      .from("patch_notes")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Patch note not found" },
        { status: 404 }
      );
    }

    // Validate and map the updated row
    const mappedResult = safeMapPatchNoteRowToDomain(data);
    if (!mappedResult.success) {
      console.error("Failed to validate updated patch note:", mappedResult.error);
      // Still return the raw data, but log the validation error
      return NextResponse.json(data);
    }

    return NextResponse.json(mappedResult.data);
  } catch (error) {
    console.error("API error:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: `Validation error: ${error.message}` },
        { status: 400 }
      );
    }
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
