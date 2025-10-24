import { NextRequest, NextResponse } from 'next/server';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { webpackOverride } from '@/remotion-webpack-override';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { createClient } from '@/lib/supabase/server';
import { generateVideoTopChangesFromContent, generateVideoTopChanges } from '@/lib/ai-summarizer';

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;
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
    
    // Fetch the patch note from database to get AI summaries, final content, detailed contexts, and manual video edits
    const supabase = await createClient();
    const { data: patchNote, error: fetchError } = await supabase
      .from('patch_notes')
      .select('ai_summaries, video_data, repo_name, content, ai_detailed_contexts, video_top_changes')
      .eq('id', patchNoteId)
      .single();
      
    if (fetchError) {
      console.error('❌ Failed to fetch patch note:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch patch note' },
        { status: 500 }
      );
    }
    
    // Prefer final content over generic video_data
    let finalVideoData = videoData;
    
    const repoNameOnly = patchNote.repo_name?.includes('/') 
      ? patchNote.repo_name.split('/').pop() || patchNote.repo_name 
      : patchNote.repo_name || 'repository';
    
    // PRIORITY 0: Use manually edited video top changes if available
    if (patchNote.video_top_changes && Array.isArray(patchNote.video_top_changes) && patchNote.video_top_changes.length > 0) {
      console.log('✨ Using MANUALLY EDITED video top changes!');
      console.log('   - Found', patchNote.video_top_changes.length, 'edited changes');
      
      const topChanges = patchNote.video_top_changes.map((change: any) => ({
        title: change.title || '',
        description: change.description || '',
      }));
      
      // Build allChanges list from detailed contexts or ai_summaries
      let allChanges: string[] = [];
      
      if (patchNote.ai_detailed_contexts && Array.isArray(patchNote.ai_detailed_contexts) && patchNote.ai_detailed_contexts.length > 0) {
        console.log('📝 Using detailed contexts for scrolling section');
        allChanges = patchNote.ai_detailed_contexts.map((ctx: any) => {
          const commitTitle = ctx.message?.split("\n")[0] || 'Change';
          return `${commitTitle}\n${ctx.context || ctx.message}`;
        });
      } else if (patchNote.ai_summaries && Array.isArray(patchNote.ai_summaries)) {
        console.log('📝 Using ai_summaries for scrolling section');
        allChanges = patchNote.ai_summaries.map((summary: any) => {
          const commitTitle = summary.message.split("\n")[0];
          return `${commitTitle}\n${summary.aiSummary || summary.message}`;
        });
      }
      
      finalVideoData = {
        langCode: "en",
        topChanges,
        allChanges,
      };
      
      console.log('📹 Using manually edited video data:');
      console.log('   - Top changes:', topChanges.length);
      console.log('   - All changes (scrolling):', allChanges.length);
    }
    
    // PRIORITY 1: Use final changelog content if available (only if no manual edits)
    if (!finalVideoData?.topChanges && patchNote.content && typeof patchNote.content === 'string' && patchNote.content.length > 100) {
      console.log('✨ Using FINAL CHANGELOG CONTENT for video generation!');
      console.log('   - Content length:', patchNote.content.length, 'chars');
      
      // Extract top 3 from the polished final output
      console.log('🤖 Extracting top 3 from final changelog...');
      const topChanges = await generateVideoTopChangesFromContent(patchNote.content, repoNameOnly);
      
      if (topChanges.length > 0) {
        console.log('✅ Extracted', topChanges.length, 'changes from final content');
        
        // Build allChanges list - prioritize detailed contexts, fallback to ai_summaries
        let allChanges: string[] = [];
        
        if (patchNote.ai_detailed_contexts && Array.isArray(patchNote.ai_detailed_contexts) && patchNote.ai_detailed_contexts.length > 0) {
          console.log('📝 Using detailed contexts for scrolling section');
          allChanges = patchNote.ai_detailed_contexts.map((ctx: any) => {
            // Each detailed context has: message, context (the detailed summary), additions, deletions, authors
            const commitTitle = ctx.message?.split("\n")[0] || 'Change';
            return `${commitTitle}\n${ctx.context || ctx.message}`;
          });
        } else if (patchNote.ai_summaries && Array.isArray(patchNote.ai_summaries)) {
          console.log('📝 Using ai_summaries for scrolling section');
          allChanges = patchNote.ai_summaries.map((summary: any) => {
            const commitTitle = summary.message.split("\n")[0];
            return `${commitTitle}\n${summary.aiSummary || summary.message}`;
          });
        }
        
        finalVideoData = {
          langCode: "en",
          topChanges,
          allChanges,
        };
        
        console.log('📹 Generated video data from final content:');
        console.log('   - Top changes:', topChanges.length);
        console.log('   - All changes (scrolling):', allChanges.length);
        console.log('   - First change:', topChanges[0]?.title?.substring(0, 50));
        console.log('   - First desc:', topChanges[0]?.description?.substring(0, 80));
      } else {
        console.warn('⚠️  No changes extracted from content, falling back to ai_summaries');
      }
    }
    
    // PRIORITY 2: Fallback to ai_summaries if no content or extraction failed
    if (!finalVideoData?.topChanges && patchNote.ai_summaries && Array.isArray(patchNote.ai_summaries) && patchNote.ai_summaries.length > 0) {
      console.log('⚠️  Falling back to AI summaries for video generation');
      console.log('   - Found', patchNote.ai_summaries.length, 'AI summaries');
      
      const aiSummaries = patchNote.ai_summaries as Array<{
        sha: string;
        message: string;
        aiSummary: string;
        additions: number;
        deletions: number;
      }>;
      
      const topChanges = await generateVideoTopChanges(aiSummaries, repoNameOnly);
      
      // Build allChanges for scrolling - use detailed contexts if available
      let allChanges: string[] = [];
      
      if (patchNote.ai_detailed_contexts && Array.isArray(patchNote.ai_detailed_contexts) && patchNote.ai_detailed_contexts.length > 0) {
        console.log('📝 Using detailed contexts for scrolling section');
        allChanges = patchNote.ai_detailed_contexts.map((ctx: any) => {
          const commitTitle = ctx.message?.split("\n")[0] || 'Change';
          return `${commitTitle}\n${ctx.context || ctx.message}`;
        });
      } else {
        console.log('📝 Using ai_summaries for scrolling section');
        allChanges = aiSummaries.map((summary) => {
          const commitTitle = summary.message.split("\n")[0];
          return `${commitTitle}\n${summary.aiSummary || summary.message}`;
        });
      }
      
      finalVideoData = {
        langCode: "en",
        topChanges,
        allChanges,
      };
    } else if (!finalVideoData?.topChanges) {
      console.log('⚠️  No content or AI summaries found, using fallback video_data');
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

    // Create a temporary output directory for the render
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repatch-video-'));

    // Generate unique filename
    const filename = `patch-note-${patchNoteId}-${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, filename);

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

    // Upload the rendered video to Supabase storage
    const bucket = process.env.SUPABASE_VIDEOS_BUCKET || 'videos';
    const storagePath = `patch-notes/${patchNoteId}/${filename}`;
    console.log('☁️  Uploading video to Supabase storage bucket:', bucket);

    const fileBuffer = await fs.readFile(outputPath);
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Failed to upload video to Supabase storage:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload rendered video' },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    const videoUrl = publicUrlData?.publicUrl;

    if (!videoUrl) {
      console.error('❌ Unable to retrieve public URL for uploaded video');
      return NextResponse.json(
        { error: 'Failed to generate video URL' },
        { status: 500 }
      );
    }

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
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

