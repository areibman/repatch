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
          ai_summaries: body.ai_summaries || null,
          ai_overall_summary: body.ai_overall_summary || null,
          generated_at: body.generated_at || new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const shouldTriggerVideo =
      process.env.DISABLE_VIDEO_RENDER !== '1' && body.video_data && data.id;

    // Trigger video rendering asynchronously (don't wait for it)
    if (shouldTriggerVideo) {
      const videoRenderUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/videos/render`;
      console.log('🎬 Triggering video rendering...');
      console.log('   - Patch Note ID:', data.id);
      console.log('   - Repo:', body.repo_name);
      console.log('   - Video API URL:', videoRenderUrl);
      console.log('   - Has video_data:', !!body.video_data);
      
      fetch(videoRenderUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patchNoteId: data.id,
          videoData: body.video_data,
          repoName: body.repo_name,
        }),
      }).then(res => {
        console.log('✅ Video rendering request sent, status:', res.status);
        return res.json();
      }).then(result => {
        console.log('✅ Video rendering response:', result);
      }).catch((err) => {
        console.error('❌ Background video rendering failed:', err);
        // Don't fail the patch note creation if video rendering fails
      });
    } else {
      console.log('⚠️  Video rendering NOT triggered:', {
        hasVideoData: !!body.video_data,
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
