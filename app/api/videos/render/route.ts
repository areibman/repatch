import { NextRequest, NextResponse } from 'next/server';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { webpackOverride } from '@/remotion-webpack-override';
import path from 'path';
import fs from 'fs/promises';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { patchNoteId, videoData, repoName } = await request.json();

    console.log('🎬 VIDEO RENDER API CALLED');
    console.log('   - Patch Note ID:', patchNoteId);
    console.log('   - Repo Name:', repoName);
    console.log('   - Has videoData:', !!videoData);

    if (!patchNoteId) {
      console.error('❌ Missing patchNoteId!');
      return NextResponse.json(
        { error: 'Missing patchNoteId' },
        { status: 400 }
      );
    }

    console.log('✅ Starting video render for patch note:', patchNoteId);
    
    // Fetch the patch note from database to get AI summaries
    const supabase = await createClient();
    const { data: patchNote, error: fetchError } = await supabase
      .from('patch_notes')
      .select('ai_summaries, video_data, repo_name')
      .eq('id', patchNoteId)
      .single();
      
    if (fetchError) {
      console.error('❌ Failed to fetch patch note:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch patch note' },
        { status: 500 }
      );
    }
    
    // Prefer AI summaries over generic video_data
    let finalVideoData = videoData;
    
    if (patchNote.ai_summaries && Array.isArray(patchNote.ai_summaries) && patchNote.ai_summaries.length > 0) {
      console.log('✨ Using AI summaries for video generation!');
      console.log('   - Found', patchNote.ai_summaries.length, 'AI summaries');
      
      // Generate video data from AI summaries
      const aiSummaries = patchNote.ai_summaries as Array<{
        sha: string;
        message: string;
        aiSummary: string;
        additions: number;
        deletions: number;
      }>;
      
      const topChanges = aiSummaries.slice(0, 3).map((summary) => {
        const commitTitle = summary.message.split("\n")[0];
        return {
          title: commitTitle.length > 60 ? commitTitle.substring(0, 60) + "..." : commitTitle,
          description: summary.aiSummary,
        };
      });
      
      const allChanges = aiSummaries.map((summary) => {
        const commitTitle = summary.message.split("\n")[0];
        const shortTitle = commitTitle.length > 50 ? commitTitle.substring(0, 50) + "..." : commitTitle;
        return `${shortTitle}: ${summary.aiSummary}`;
      });
      
      finalVideoData = {
        langCode: "en",
        topChanges,
        allChanges,
      };
      
      console.log('📹 Generated AI-powered video data:');
      console.log('   - Top changes:', topChanges.length);
      console.log('   - First change:', topChanges[0]?.title?.substring(0, 50));
      console.log('   - First AI summary:', topChanges[0]?.description?.substring(0, 80));
    } else {
      console.log('⚠️  No AI summaries found, using fallback video_data');
    }
    
    console.log('📹 Final video data structure:');
    console.log('   - Top changes:', finalVideoData.topChanges?.length || 0);
    console.log('   - All changes:', finalVideoData.allChanges?.length || 0);

    // Bundle the Remotion project
    console.log('📦 Bundling Remotion project...');
    const bundleLocation = await bundle(
      path.resolve(process.cwd(), 'remotion/index.ts'),
      () => undefined,
      {
        webpackOverride,
      }
    );

    console.log('Bundle location:', bundleLocation);

    // Get composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'basecomp',
      inputProps: {
        repositorySlug: patchNote.repo_name || repoName || 'repository',
        releaseTag: 'Latest Update',
        openaiGeneration: finalVideoData,
        ...finalVideoData,
      },
    });

    console.log('Composition selected:', composition.id);

    // Create output directory
    const outputDir = path.resolve(process.cwd(), 'public', 'videos');
    await fs.mkdir(outputDir, { recursive: true });

    // Generate unique filename
    const filename = `patch-note-${patchNoteId}-${Date.now()}.mp4`;
    const outputPath = path.join(outputDir, filename);

    console.log('🎬 Rendering video to:', outputPath);

    // Render the video
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: {
        repositorySlug: patchNote.repo_name || repoName || 'repository',
        releaseTag: 'Latest Update',
        openaiGeneration: finalVideoData,
        ...finalVideoData,
      },
    });

    console.log('✅ Video rendered successfully to:', outputPath);

    // The video URL will be accessible at /videos/filename
    const videoUrl = `/videos/${filename}`;
    console.log('📝 Updating database with video URL:', videoUrl);

    // Update the patch note with the video URL (reuse existing supabase client)
    const { data: updateData, error: updateError } = await supabase
      .from('patch_notes')
      .update({ video_url: videoUrl })
      .eq('id', patchNoteId)
      .select();

    if (updateError) {
      console.error('❌ Failed to update patch note with video URL:', updateError);
      console.error('   Error details:', JSON.stringify(updateError, null, 2));
    } else {
      console.log('✅ Database updated successfully!');
      console.log('   Updated rows:', updateData);
    }

    return NextResponse.json({
      success: true,
      videoUrl,
      message: 'Video rendered successfully',
    });
  } catch (error) {
    console.error('Error rendering video:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to render video',
      },
      { status: 500 }
    );
  }
}

