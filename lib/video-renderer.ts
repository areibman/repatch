import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { webpackOverride } from '@/remotion-webpack-override';
import path from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { generateVideoTopChangesFromContent, generateVideoTopChanges } from '@/lib/ai-summarizer';

export async function renderPatchNoteVideo(patchNoteId: string, videoData?: any, repoName?: string) {
  console.log('🎬 Starting video render for patch note:', patchNoteId);
  
  // Fetch the patch note from database
  const supabase = await createClient();
  const { data: patchNote, error: fetchError } = await supabase
    .from('patch_notes')
    .select('ai_summaries, video_data, repo_name, content, ai_detailed_contexts, video_top_changes')
    .eq('id', patchNoteId)
    .single();
    
  if (fetchError) {
    console.error('❌ Failed to fetch patch note:', fetchError);
    throw new Error('Failed to fetch patch note');
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
    
    const topChanges = await generateVideoTopChangesFromContent(patchNote.content, repoNameOnly);
    
    if (topChanges.length > 0) {
      console.log('✅ Extracted', topChanges.length, 'changes from final content');
      
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
    } else {
      console.warn('⚠️  No changes extracted from content, falling back to ai_summaries');
    }
  }
  
  // PRIORITY 2: Fallback to ai_summaries if no content or extraction failed
  if (!finalVideoData?.topChanges && patchNote.ai_summaries && Array.isArray(patchNote.ai_summaries) && patchNote.ai_summaries.length > 0) {
    console.log('⚠️  Falling back to AI summaries for video generation');
    
    const aiSummaries = patchNote.ai_summaries as Array<{
      sha: string;
      message: string;
      aiSummary: string;
      additions: number;
      deletions: number;
    }>;
    
    const topChanges = await generateVideoTopChanges(aiSummaries, repoNameOnly);
    
    let allChanges: string[] = [];
    
    if (patchNote.ai_detailed_contexts && Array.isArray(patchNote.ai_detailed_contexts) && patchNote.ai_detailed_contexts.length > 0) {
      allChanges = patchNote.ai_detailed_contexts.map((ctx: any) => {
        const commitTitle = ctx.message?.split("\n")[0] || 'Change';
        return `${commitTitle}\n${ctx.context || ctx.message}`;
      });
    } else {
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

  // Generate unique filename
  const filename = `patch-note-${patchNoteId}-${Date.now()}.mp4`;
  const outputPath = path.join(tmpdir(), filename);

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

  const serviceSupabase = createServiceClient();
  const videoBucket = process.env.SUPABASE_VIDEO_BUCKET || 'videos';
  const storagePath = `${patchNoteId}/${filename}`;

  console.log('☁️  Uploading video to Supabase Storage bucket:', videoBucket);

  let videoUrl: string | null = null;

  try {
    const fileBuffer = await fs.readFile(outputPath);

    const { error: uploadError } = await serviceSupabase.storage
      .from(videoBucket)
      .upload(storagePath, fileBuffer, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Failed to upload video to Supabase Storage:', uploadError);
      throw new Error('Failed to upload video to storage');
    }

    videoUrl = storagePath;
    console.log('✅ Video uploaded to storage path:', storagePath);
  } finally {
    await fs.unlink(outputPath).catch(err => {
      console.warn('⚠️  Failed to clean up temporary video file:', err);
    });
  }

  if (!videoUrl) {
    throw new Error('Video storage path missing after upload');
  }

  console.log('📝 Updating database with video storage path:', videoUrl);

  // Update the patch note with the video URL
  const { error: updateError } = await supabase
    .from('patch_notes')
    .update({ video_url: videoUrl })
    .eq('id', patchNoteId);

  if (updateError) {
    console.error('❌ Failed to update patch note with video URL:', updateError);
    throw new Error('Failed to update database');
  }

  console.log('✅ Database updated successfully!');

  return { videoUrl };
}

