import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { generateVideoTopChangesFromContent } from "@/lib/ai-summarizer";
import { generateBoilerplateContent } from "@/lib/github";

// Configure maximum duration for this route (5 minutes)
// This allows enough time for GitHub fetching + AI analysis + video generation
export const maxDuration = 300; // 5 minutes

// POST /api/patch-notes/[id]/process - Process a pending patch note
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('📥 Received process request');
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
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
    console.log('   - Owner/Repo:', `${owner}/${repo}`);
    console.log('   - Branch:', branch);
    console.log('   - Filters:', JSON.stringify(filters));

    // Update status to fetching_stats
    await supabase
      .from("patch_notes")
      .update({
        processing_status: "fetching_stats",
        processing_stage: "Fetching repository statistics...",
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
        processing_status: videoData ? "generating_video" : "completed",
        processing_stage: videoData ? "Preparing video render..." : null,
      })
      .eq("id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Frontend will trigger video rendering via /render-video endpoint
    // This ensures reliable execution and better separation of concerns
    console.log('✅ Content generation complete');
    if (videoData) {
      console.log('   - Video data ready with', videoData.topChanges?.length || 0, 'top changes');
      console.log('   - Frontend should call /render-video endpoint');
    }

    return NextResponse.json({ 
      success: true,
      hasVideoData: !!videoData 
    });
  } catch (error) {
    console.error("❌ Processing error:", error);
    
    // Update patch note with error status
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
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
