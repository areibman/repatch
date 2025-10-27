import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderPatchNoteVideoOnLambda } from "@/lib/remotion-lambda-renderer";

// No longer needs extended timeout since we moved AI processing to background
// export const maxDuration = 90; // 90 seconds

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

    // Don't generate video top changes here - let the background process handle it
    // This ensures the modal closes immediately
    const videoData = body.video_data;

    const { data, error } = await supabase
      .from("patch_notes")
      .insert([
        {
          repo_name: body.repo_name,
          repo_url: body.repo_url,
          repo_branch: body.repo_branch || 'main',
          time_period: body.time_period,
          title: body.title,
          content: body.content,
          changes: body.changes,
          contributors: body.contributors,
          video_data: videoData,
          video_top_changes: null, // Will be generated during background processing
          ai_summaries: body.ai_summaries || null,
          ai_overall_summary: body.ai_overall_summary || null,
          ai_detailed_contexts: body.ai_detailed_contexts || null,
          ai_template_id: body.ai_template_id || null,
          filter_metadata: body.filter_metadata || null,
          generated_at: body.generated_at || new Date().toISOString(),
          processing_status: body.processing_status || 'completed',
          processing_stage: body.processing_stage || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Only trigger video rendering if the patch note is completed (not pending)
    if (videoData && data.id && body.processing_status !== 'pending') {
      console.log('🎬 Triggering Lambda video rendering...');
      console.log('   - Patch Note ID:', data.id);
      console.log('   - Repo:', body.repo_name);

      // Call the Lambda render function directly - no HTTP request needed!
      renderPatchNoteVideoOnLambda(data.id, videoData, body.repo_name)
        .then((result: { videoUrl: string }) => {
          console.log('✅ Lambda video rendering completed:', result);
        })
        .catch((err: Error) => {
          console.error('❌ Background Lambda video rendering failed:', err);
          // Don't fail the patch note creation if video rendering fails
        });
    } else if (body.processing_status === 'pending') {
      console.log('⏳ Patch note is pending - will process later');
    } else {
      console.log('⚠️  Video rendering NOT triggered:', {
        hasVideoData: !!videoData,
        hasId: !!data.id
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
}
