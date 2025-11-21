import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api/with-auth";
import { renderVideo } from "@/lib/services";

const PATCH_NOTE_COLUMNS =
  "id, repo_name, repo_url, repo_branch, time_period, generated_at, title, content, changes, contributors, video_url, filter_metadata, processing_status, processing_stage, processing_error, owner_id";

// No longer needs extended timeout since we moved AI processing to background
// export const maxDuration = 90; // 90 seconds

// GET /api/patch-notes - Fetch all patch notes
export async function GET() {
  return withApiAuth(
    async ({ supabase, auth }) => {
      const start = Date.now();
      const authType = auth.token ? `token:${auth.token.prefix}` : "session";
      console.log(
        `[API][patch-notes] user=${auth.user.id} via=${authType} fetching patch notes`
      );

      const { data, error } = await supabase
        .from("patch_notes")
        .select(PATCH_NOTE_COLUMNS)
        .order("generated_at", { ascending: false });

      if (error) {
        console.error("[API][patch-notes] query failed:", error);
        return NextResponse.json(
          { error: "Failed to fetch patch notes" },
          { status: 500 }
        );
      }

      console.log(
        `[API][patch-notes] user=${auth.user.id} fetched ${
          data?.length ?? 0
        } rows in ${Date.now() - start}ms`
      );

      return NextResponse.json(data ?? []);
    },
    { skipProfile: true }
  );
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
