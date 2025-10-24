import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateVideoTopChangesFromContent } from "@/lib/ai-summarizer";

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

    // Generate video top changes from the final content
    let videoTopChanges = null;
    if (body.content && body.repo_name) {
      try {
        console.log('🎬 Generating video top 3 from final content...');
        videoTopChanges = await generateVideoTopChangesFromContent(
          body.content,
          body.repo_name
        );
        console.log('✅ Generated', videoTopChanges?.length || 0, 'video top changes');
      } catch (error) {
        console.error('⚠️ Failed to generate video top changes:', error);
        // Continue without video top changes - can be regenerated later
      }
    }

    // Create video data structure for video rendering
    let videoData = body.video_data;
    if (videoTopChanges && videoTopChanges.length > 0) {
      videoData = {
        langCode: 'en',
        topChanges: videoTopChanges,
        allChanges: [], // Can be populated later if needed
      };
    }

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
          video_top_changes: videoTopChanges,
          ai_summaries: body.ai_summaries || null,
          ai_overall_summary: body.ai_overall_summary || null,
          ai_detailed_contexts: body.ai_detailed_contexts || null,
          ai_template_id: body.ai_template_id || null,
          filter_metadata: body.filter_metadata || null,
          generated_at: body.generated_at || new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger video rendering asynchronously (don't wait for it)
    if (videoData && data.id) {
      // In Vercel production, use VERCEL_URL; in local dev, use localhost
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                      'http://localhost:3000');
      const videoRenderUrl = `${baseUrl}/api/videos/render`;
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
          videoData: videoData,
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
