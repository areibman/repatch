import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api/with-auth";
import { renderVideo } from "@/lib/services";
import { createServerSupabaseClient } from "@/lib/supabase";

// No longer needs extended timeout since we moved AI processing to background
// export const maxDuration = 90; // 90 seconds

// GET /api/patch-notes - Fetch all patch notes
export async function GET() {
  const start = Date.now();
  console.log("[API] Fetching patch notes started");

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    // Optimization: Run Auth check and DB query in parallel
    // Using getSession() is faster than getUser() as it validates the JWT locally without a remote call
    // We trust the JWT for read operations; RLS still enforces security at the DB layer
    const authPromise = supabase.auth.getSession();
    const dbPromise = supabase
      .from("patch_notes")
      .select(
        "id, repo_name, repo_url, repo_branch, time_period, generated_at, title, content, changes, contributors, video_url, filter_metadata, processing_status, processing_stage, processing_error, owner_id"
      )
      .order("generated_at", { ascending: false });

    const [authResult, dbResult] = await Promise.all([authPromise, dbPromise]);
    
    const { error: authError, data: authData } = authResult;
    let { error: dbError, data: dbData } = dbResult;

    console.log(`[API] Parallel operations completed in ${Date.now() - start}ms`);

    // 1. Check Auth Failure
    if (authError || !authData.session) {
      console.warn("[API] No local session, trying remote verification...", authError?.message);
      
      // Fallback: Try remote verification (getUser) if local session check fails
      const { data: remoteData, error: remoteError } = await supabase.auth.getUser();
      
      if (remoteError || !remoteData.user) {
        console.warn("[API] Remote verification failed:", remoteError?.message);
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    // 2. Retry DB if it failed but Auth succeeded (e.g. token refresh race condition)
    if (dbError) {
      console.warn("[API] Initial DB query failed, retrying with refreshed token...", dbError.message);
      const retryStart = Date.now();
      
      // The supabase client should now have the refreshed token from the getUser call
      const retryResult = await supabase
        .from("patch_notes")
        .select(
          "id, repo_name, repo_url, repo_branch, time_period, generated_at, title, content, changes, contributors, video_url, filter_metadata, processing_status, processing_stage, processing_error, owner_id"
        )
        .order("generated_at", { ascending: false });
        
      dbError = retryResult.error;
      dbData = retryResult.data;
      
      console.log(`[API] DB Retry took ${Date.now() - retryStart}ms`);
    }

    if (dbError) {
      console.error("[API] DB Error:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json(dbData);
  } catch (error) {
    console.error(`[API] Error after ${Date.now() - start}ms:`, error);
    return NextResponse.json(
      { error: "Failed to fetch patch notes" },
      { status: 500 }
    );
  }
}

// POST /api/patch-notes - Create a new patch note
export async function POST(request: NextRequest) {
  return withApiAuth(async ({ supabase, auth }) => {
    try {
      const body = await request.json();

      const videoData = body.video_data;

      const { data, error } = await supabase
        .from("patch_notes")
        .insert([
          {
            repo_name: body.repo_name,
            repo_url: body.repo_url,
            repo_branch: body.repo_branch || "main",
            time_period: body.time_period,
            title: body.title,
            content: body.content,
            changes: body.changes,
            contributors: body.contributors,
            video_data: videoData,
            video_top_changes: null,
            ai_summaries: body.ai_summaries || null,
            ai_overall_summary: body.ai_overall_summary || null,
            ai_detailed_contexts: body.ai_detailed_contexts || null,
            ai_template_id: body.ai_template_id || null,
            filter_metadata: body.filter_metadata || null,
            generated_at: body.generated_at || new Date().toISOString(),
            processing_status: body.processing_status || "completed",
            processing_stage: body.processing_stage || null,
            owner_id: auth.user.id,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (videoData && data.id && body.processing_status !== "pending") {
        renderVideo({ patchNoteId: data.id })
          .then((result) => {
            if (!result.success) {
              console.error("Failed to start video render:", result.error);
            }
          })
          .catch((error: Error) => {
            console.error("Unexpected error in video render:", error);
          });
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
  });
}
