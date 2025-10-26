import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { generateVideoTopChangesFromContent, generateVideoTopChanges } from '@/lib/ai-summarizer';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const REMOTION_APP_FUNCTION_NAME = process.env.REMOTION_APP_FUNCTION_NAME || 'remotion-render-4-0-355-mem2048mb-disk2048mb-300sec';
const REMOTION_APP_SERVE_URL = process.env.REMOTION_APP_SERVE_URL || 'https://remotionlambda-useast1-slzcsqmp1p.s3.us-east-1.amazonaws.com/sites/repatch-video-renderer/index.html';

export async function renderPatchNoteVideoOnLambda(patchNoteId: string, videoData?: any, repoName?: string) {
  console.log('🎬 Starting Lambda video render for patch note:', patchNoteId);

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

  console.log('☁️  Rendering video on Lambda...');
  console.log('   - Region:', AWS_REGION);
  console.log('   - Function:', REMOTION_APP_FUNCTION_NAME);
  console.log('   - Serve URL:', REMOTION_APP_SERVE_URL);

  try {
    // Render on Lambda
    const renderResponse = await renderMediaOnLambda({
      region: AWS_REGION as any,
      functionName: REMOTION_APP_FUNCTION_NAME,
      serveUrl: REMOTION_APP_SERVE_URL,
      composition: 'basecomp',
      inputProps: {
        repositorySlug: patchNote.repo_name || repoName || 'repository',
        releaseTag: 'Latest Update',
        openaiGeneration: finalVideoData,
        ...finalVideoData,
      },
      codec: 'h264',
      imageFormat: 'jpeg',
      maxRetries: 1,
      privacy: 'public',
    });

    console.log('✅ Lambda render initiated!');
    console.log('   - Render ID:', renderResponse.renderId);
    console.log('   - Bucket:', renderResponse.bucketName);

    // Wait for render to complete and get the output URL
    console.log('⏳ Waiting for render to complete...');
    let progress = await getRenderProgress({
      region: AWS_REGION as any,
      functionName: REMOTION_APP_FUNCTION_NAME,
      bucketName: renderResponse.bucketName,
      renderId: renderResponse.renderId,
    });

    while (!progress.done && !progress.fatalErrorEncountered) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      progress = await getRenderProgress({
        region: AWS_REGION as any,
        functionName: REMOTION_APP_FUNCTION_NAME,
        bucketName: renderResponse.bucketName,
        renderId: renderResponse.renderId,
      });
      console.log(`   Progress: ${Math.round((progress.overallProgress || 0) * 100)}%`);
    }

    if (progress.fatalErrorEncountered) {
      throw new Error(`Render failed: ${progress.errors?.[0]?.message || 'Unknown error'}`);
    }

    if (!progress.outputFile) {
      throw new Error('Render completed but no output file was produced');
    }

    console.log('✅ Lambda render completed!');
    console.log('   - Output file:', progress.outputFile);
    console.log('   - Full progress object:', JSON.stringify(progress, null, 2));

    const serviceSupabase = createServiceClient();

    // Construct the correct S3 URL
    // Check if outputFile is already a full URL or just a key
    let videoUrl: string;
    if (progress.outputFile.startsWith('http://') || progress.outputFile.startsWith('https://')) {
      // Already a full URL
      videoUrl = progress.outputFile;
      console.log('📝 Using provided URL directly:', videoUrl);
    } else {
      // It's just an S3 key, construct the URL
      videoUrl = `https://${renderResponse.bucketName}.s3.${AWS_REGION}.amazonaws.com/${progress.outputFile}`;
      console.log('📝 Constructed video URL:', videoUrl);
      console.log('   - Bucket:', renderResponse.bucketName);
      console.log('   - Region:', AWS_REGION);
      console.log('   - Key:', progress.outputFile);
    }

    // Try to verify the video URL is accessible
    try {
      const headResponse = await fetch(videoUrl, { method: 'HEAD' });
      if (headResponse.ok) {
        console.log('✅ Video URL is publicly accessible!');
      } else {
        console.warn('⚠️  Video URL returned status:', headResponse.status);
        console.warn('⚠️  This may indicate S3 bucket permissions issue');
      }
    } catch (verifyError) {
      console.warn('⚠️  Could not verify video URL accessibility:', verifyError);
      console.warn('⚠️  The video may exist but S3 bucket may need public read permissions');
    }

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

    return { videoUrl, renderId: renderResponse.renderId };
  } catch (error) {
    console.error('❌ Lambda render failed:', error);
    throw error;
  }
}
