import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TypefullyClient, patchNoteToThread, formatPatchNoteSummary } from "@/lib/typefully";
import { Database } from "@/lib/supabase/database.types";

type PatchNote = Database["public"]["Tables"]["patch_notes"]["Row"];

// POST /api/patch-notes/[id]/queue-thread - Queue a Twitter thread via Typefully
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { scheduleFor, includeVideo } = body;
    
    const supabase = await createClient();

    // Fetch the patch note
    const { data: patchNote, error: patchNoteError } = await supabase
      .from("patch_notes")
      .select("*")
      .eq("id", id)
      .single();

    if (patchNoteError || !patchNote) {
      return NextResponse.json(
        { error: "Patch note not found" },
        { status: 404 }
      );
    }

    // Get Typefully configuration
    const { data: typefullyConfig, error: configError } = await supabase
      .from("typefully_configs")
      .select("*")
      .single();

    if (configError || !typefullyConfig) {
      return NextResponse.json(
        { error: "Typefully not configured. Please connect Typefully first." },
        { status: 400 }
      );
    }

    // Check if there's already a job for this patch note
    const { data: existingJob } = await supabase
      .from("typefully_jobs")
      .select("*")
      .eq("patch_note_id", id)
      .eq("status", "queued")
      .single();

    if (existingJob) {
      return NextResponse.json(
        { error: "A thread is already queued for this patch note" },
        { status: 400 }
      );
    }

    // Convert patch note to thread
    const threadContent = patchNoteToThread(patchNote as PatchNote);

    // Prepare media if video is included
    let mediaUrls: string[] = [];
    if (includeVideo && patchNote.video_url) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                      'http://localhost:3000');
      
      // Convert relative URL to absolute if needed
      const videoUrl = patchNote.video_url.startsWith('http') 
        ? patchNote.video_url 
        : `${baseUrl}${patchNote.video_url}`;
      
      mediaUrls = [videoUrl];
    }

    // Initialize Typefully client
    const typefully = new TypefullyClient(typefullyConfig.api_key);

    try {
      // Create draft on Typefully
      const draft = await typefully.createDraft({
        content: threadContent,
        schedule: scheduleFor, // Optional: ISO 8601 datetime string
        threadify: true,
        media: mediaUrls,
      });

      // Save job to database
      const { data: job, error: jobError } = await supabase
        .from("typefully_jobs")
        .insert({
          patch_note_id: id,
          typefully_draft_id: draft.id,
          typefully_post_url: draft.url,
          thread_content: threadContent,
          video_url: mediaUrls[0] || null,
          status: scheduleFor ? "scheduled" : "queued",
          scheduled_for: scheduleFor || null,
        })
        .select()
        .single();

      if (jobError) {
        // Try to clean up the draft on Typefully if database save fails
        try {
          await typefully.deleteDraft(draft.id);
        } catch (cleanupError) {
          console.error("Failed to cleanup Typefully draft:", cleanupError);
        }
        throw jobError;
      }

      return NextResponse.json({
        success: true,
        job,
        draftUrl: draft.url,
        threadPreview: threadContent,
      });
    } catch (typefullyError: any) {
      console.error("Typefully API error:", typefullyError);
      
      // Save failed job for debugging
      await supabase.from("typefully_jobs").insert({
        patch_note_id: id,
        thread_content: threadContent,
        video_url: mediaUrls[0] || null,
        status: "failed",
        error_message: typefullyError.message || "Failed to create draft on Typefully",
      });

      return NextResponse.json(
        { error: typefullyError.message || "Failed to create thread on Typefully" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to queue thread",
      },
      { status: 500 }
    );
  }
}

// GET /api/patch-notes/[id]/queue-thread - Get thread status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get all jobs for this patch note
    const { data: jobs, error } = await supabase
      .from("typefully_jobs")
      .select("*")
      .eq("patch_note_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      jobs: jobs || [],
      hasActiveJob: jobs?.some(j => ["queued", "scheduled"].includes(j.status)) || false,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch thread status" },
      { status: 500 }
    );
  }
}