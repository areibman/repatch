import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateVideoTopChangesFromContent } from "@/lib/ai-summarizer";
import { renderPatchNoteVideoOnLambda } from "@/lib/remotion-lambda-renderer";
import { generateBoilerplateContent } from "@/lib/github";

// Configure maximum duration for this route (5 minutes)
// This allows enough time for GitHub fetching + AI analysis + video generation
export const maxDuration = 300; // 5 minutes

// POST /api/patch-notes/[id]/process - Process a pending patch note
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id } = await params;

    const {
      owner,
      repo,
      repoUrl,
      branch,
      filters,
      templateId,
      generateCommitTitles,
    } = body;

    console.log('🚀 Starting async processing for patch note:', id);

    // Update status to fetching_stats
    await supabase
      .from("patch_notes")
      .update({
        processing_status: "fetching_stats",
        processing_stage: "Fetching repository statistics...",
        processing_progress: 10,
      })
      .eq("id", id);

    // Fetch real GitHub statistics via API route
    const statsResponse = await fetch(`${request.nextUrl.origin}/api/github/stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner,
        repo,
        branch,
        filters,
      }),
    });

    if (!statsResponse.ok) {
      const error = await statsResponse.json();
      throw new Error(error.error || 'Failed to fetch repository stats');
    }

    const stats = await statsResponse.json();

    // Update status to analyzing_commits
    await supabase
      .from("patch_notes")
      .update({
        processing_status: "analyzing_commits",
        processing_stage: "Analyzing commits with AI (30-60s)...",
        processing_progress: 30,
      })
      .eq("id", id);

    // Generate AI summaries for commits
    const summariesResponse = await fetch(`${request.nextUrl.origin}/api/github/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner,
        repo,
        filters,
        branch,
        templateId: templateId || undefined,
        generateCommitTitles: !generateCommitTitles,
      }),
    });

    let aiGeneratedContent: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detailedContexts: any[] = [];

    if (summariesResponse.ok) {
      const summaryData = await summariesResponse.json();
      aiGeneratedContent = summaryData.content || null;
      detailedContexts = summaryData.detailedContexts || [];
      console.log('✅ AI changelog generated from', detailedContexts.length, 'commits');
    } else {
      console.warn('⚠️  Failed to generate AI changelog, continuing without it');
    }

    // Update status to generating_content
    await supabase
      .from("patch_notes")
      .update({
        processing_status: "generating_content",
        processing_stage: "Generating patch note content...",
        processing_progress: 70,
      })
      .eq("id", id);

    // Use AI-generated content, or fallback to boilerplate
    const content = aiGeneratedContent
      ? aiGeneratedContent
      : generateBoilerplateContent(
          `${owner}/${repo}`,
          filters,
          stats
        );

    // Generate video top changes from the final content
    let videoTopChanges = null;
    let videoData = null;
    if (content && `${owner}/${repo}`) {
      try {
        console.log('🎬 Generating video top 3 from final content...');
        videoTopChanges = await generateVideoTopChangesFromContent(
          content,
          `${owner}/${repo}`
        );
        console.log('✅ Generated', videoTopChanges?.length || 0, 'video top changes');
        
        if (videoTopChanges && videoTopChanges.length > 0) {
          videoData = {
            langCode: 'en',
            topChanges: videoTopChanges,
            allChanges: [],
          };
        }
      } catch (error) {
        console.error('⚠️ Failed to generate video top changes:', error);
      }
    }

    // Update patch note with content and stats
    const { error: updateError } = await supabase
      .from("patch_notes")
      .update({
        content,
        changes: {
          added: stats.additions,
          modified: 0,
          removed: stats.deletions,
        },
        contributors: stats.contributors,
        ai_detailed_contexts: detailedContexts,
        video_data: videoData,
        video_top_changes: videoTopChanges,
        processing_status: "generating_video",
        processing_stage: "Rendering video...",
        processing_progress: 90,
      })
      .eq("id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Trigger video rendering asynchronously (don't wait for it)
    if (videoData) {
      console.log('🎬 Triggering Lambda video rendering...');
      console.log('   - Patch Note ID:', id);
      console.log('   - Repo:', `${owner}/${repo}`);

      // Use service client for async operations (server client won't work in callbacks)
      const serviceClient = createServiceClient();

      renderPatchNoteVideoOnLambda(id, videoData, `${owner}/${repo}`)
        .then((result: { videoUrl: string }) => {
          console.log('✅ Lambda video rendering completed:', result);
          // Mark as completed using service client
          return serviceClient
            .from("patch_notes")
            .update({
              processing_status: "completed",
              processing_stage: null,
              processing_progress: 100,
            })
            .eq("id", id);
        })
        .then(() => console.log('✅ Patch note marked as completed'))
        .catch((err: Error) => {
          console.error('❌ Background Lambda video rendering failed:', err);
          // Mark as completed anyway (video can be regenerated later)
          return serviceClient
            .from("patch_notes")
            .update({
              processing_status: "completed",
              processing_stage: null,
              processing_error: err.message,
              processing_progress: 100,
            })
            .eq("id", id)
            .then(() => console.log('⚠️ Patch note marked as completed (video failed)'));
        });
    } else {
      // No video to render, mark as completed
      await supabase
        .from("patch_notes")
        .update({
          processing_status: "completed",
          processing_stage: null,
          processing_progress: 100,
        })
        .eq("id", id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Processing error:", error);
    
    // Update patch note with error status
    const supabase = await createClient();
    const { id } = await params;
    await supabase
      .from("patch_notes")
      .update({
        processing_status: "failed",
        processing_error: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", id);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process patch note",
      },
      { status: 500 }
    );
  }
}

