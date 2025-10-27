import { renderMediaOnLambda, getRenderProgress, AwsRegion } from '@remotion/lambda/client';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { generateVideoTopChangesFromContent, generateVideoTopChanges } from '@/lib/ai-summarizer';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const REMOTION_APP_FUNCTION_NAME = process.env.REMOTION_APP_FUNCTION_NAME || 'remotion-render-4-0-355-mem2048mb-disk2048mb-300sec';
const REMOTION_APP_SERVE_URL = process.env.REMOTION_APP_SERVE_URL || 'https://remotionlambda-useast1-slzcsqmp1p.s3.us-east-1.amazonaws.com/sites/repatch-video-renderer/index.html';

interface VideoData {
  langCode: string;
  topChanges: Array<{ title: string; description: string }>;
  allChanges: string[];
}

export async function renderPatchNoteVideoOnLambda(patchNoteId: string, videoData?: VideoData, repoName?: string) {
  console.log('🎬 Starting Lambda video render for patch note:', patchNoteId);
  console.log('📋 Environment check:');
  console.log('   - AWS_REGION:', AWS_REGION || 'NOT SET');
  console.log('   - AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✓ SET' : '❌ NOT SET');
  console.log('   - AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '✓ SET' : '❌ NOT SET');
  console.log('   - REMOTION_APP_FUNCTION_NAME:', REMOTION_APP_FUNCTION_NAME || 'NOT SET');
  console.log('   - REMOTION_APP_SERVE_URL:', REMOTION_APP_SERVE_URL || 'NOT SET');
  console.log('   - Node Environment:', process.env.NODE_ENV);
  console.log('   - Vercel Environment:', process.env.VERCEL_ENV || 'not Vercel');

  // Use service client for all DB operations (works in background/async contexts)
  const supabase = createServiceClient();
  
  // Write to DB immediately to prove we're executing (since logs may not appear)
  await supabase
    .from('patch_notes')
    .update({ 
      processing_stage: 'Video renderer function started...',
      processing_progress: 92
    })
    .eq('id', patchNoteId);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topChanges = patchNote.video_top_changes.map((change: any) => ({
      title: change.title || '',
      description: change.description || '',
    }));

    // Build allChanges list from detailed contexts or ai_summaries
    let allChanges: string[] = [];

    if (patchNote.ai_detailed_contexts && Array.isArray(patchNote.ai_detailed_contexts) && patchNote.ai_detailed_contexts.length > 0) {
      console.log('📝 Using detailed contexts for scrolling section');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allChanges = patchNote.ai_detailed_contexts.map((ctx: any) => {
        const commitTitle = ctx.message?.split("\n")[0] || 'Change';
        return `${commitTitle}\n${ctx.context || ctx.message}`;
      });
    } else if (patchNote.ai_summaries && Array.isArray(patchNote.ai_summaries)) {
      console.log('📝 Using ai_summaries for scrolling section');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        allChanges = patchNote.ai_detailed_contexts.map((ctx: any) => {
          const commitTitle = ctx.message?.split("\n")[0] || 'Change';
          return `${commitTitle}\n${ctx.context || ctx.message}`;
        });
      } else if (patchNote.ai_summaries && Array.isArray(patchNote.ai_summaries)) {
        console.log('📝 Using ai_summaries for scrolling section');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  console.log('   - Top changes:', finalVideoData?.topChanges?.length || 0);
  console.log('   - All changes:', finalVideoData?.allChanges?.length || 0);

  console.log('☁️  Rendering video on Lambda...');
  console.log('   - Region:', AWS_REGION);
  console.log('   - Function:', REMOTION_APP_FUNCTION_NAME);
  console.log('   - Serve URL:', REMOTION_APP_SERVE_URL);

  // Set initial progress to 0% when starting video render
  const { error: initProgressError } = await supabase
    .from('patch_notes')
    .update({ processing_progress: 0 })
    .eq('id', patchNoteId);
  
  if (initProgressError) {
    console.warn('⚠️  Failed to set initial progress:', initProgressError);
  }

  try {
    // Validate environment variables before attempting render
    const missingVars: string[] = [];
    if (!AWS_REGION) missingVars.push('AWS_REGION');
    if (!process.env.AWS_ACCESS_KEY_ID) missingVars.push('AWS_ACCESS_KEY_ID');
    if (!process.env.AWS_SECRET_ACCESS_KEY) missingVars.push('AWS_SECRET_ACCESS_KEY');
    if (!REMOTION_APP_FUNCTION_NAME) missingVars.push('REMOTION_APP_FUNCTION_NAME');
    if (!REMOTION_APP_SERVE_URL) missingVars.push('REMOTION_APP_SERVE_URL');
    
    if (missingVars.length > 0) {
      const errorMsg = `Missing required environment variables in ${process.env.VERCEL_ENV || 'local'}: ${missingVars.join(', ')}`;
      console.error('❌', errorMsg);
      
      // Write error to DB
      await supabase
        .from('patch_notes')
        .update({ 
          processing_stage: `Missing env vars: ${missingVars.join(', ')}`,
          processing_progress: 95,
          processing_error: errorMsg
        })
        .eq('id', patchNoteId);
      
      throw new Error(errorMsg);
    }

    // Update DB to show we passed env check
    await supabase
      .from('patch_notes')
      .update({ 
        processing_stage: 'Environment validated, calling Lambda...',
        processing_progress: 93
      })
      .eq('id', patchNoteId);

    console.log('✅ All environment variables present');
    console.log('🎬 Calling renderMediaOnLambda...');
    console.log('   - Composition: basecomp');
    console.log('   - Region:', AWS_REGION);
    console.log('   - Function:', REMOTION_APP_FUNCTION_NAME);
    
    // Render on Lambda
    const renderResponse = await renderMediaOnLambda({
      region: AWS_REGION as AwsRegion,
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

    console.log('✅ Lambda render initiated successfully!');
    console.log('   - Render ID:', renderResponse.renderId);
    console.log('   - Bucket:', renderResponse.bucketName);
    console.log('   - Started at:', new Date().toISOString());

    // Wait for render to complete and get the output URL
    console.log('⏳ Waiting for render to complete...');
    let progress = await getRenderProgress({
      region: AWS_REGION as AwsRegion,
      functionName: REMOTION_APP_FUNCTION_NAME,
      bucketName: renderResponse.bucketName,
      renderId: renderResponse.renderId,
    });

    while (!progress.done && !progress.fatalErrorEncountered) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      progress = await getRenderProgress({
        region: AWS_REGION as AwsRegion,
        functionName: REMOTION_APP_FUNCTION_NAME,
        bucketName: renderResponse.bucketName,
        renderId: renderResponse.renderId,
      });
      const progressPercent = Math.round((progress.overallProgress || 0) * 100);
      console.log(`   Progress: ${progressPercent}%`);
      
      // Update database with video rendering progress
      const { error: progressUpdateError } = await supabase
        .from('patch_notes')
        .update({ processing_progress: progressPercent })
        .eq('id', patchNoteId);
      
      if (progressUpdateError) {
        console.warn('⚠️  Failed to update progress:', progressUpdateError);
      }
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

    // Update the patch note with the video URL and 100% progress
    const { error: updateError } = await supabase
      .from('patch_notes')
      .update({ 
        video_url: videoUrl,
        processing_progress: 100
      })
      .eq('id', patchNoteId);

    if (updateError) {
      console.error('❌ Failed to update patch note with video URL:', updateError);
      throw new Error('Failed to update database');
    }

    console.log('✅ Database updated successfully!');

    return { videoUrl, renderId: renderResponse.renderId };
  } catch (error) {
    console.error('❌ Lambda render failed at:', new Date().toISOString());
    console.error('   Error type:', error?.constructor?.name || typeof error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
      
      // Check for specific AWS/Remotion errors
      if (error.message.includes('credentials')) {
        console.error('   ⚠️  This looks like an AWS credentials issue');
      } else if (error.message.includes('Function not found')) {
        console.error('   ⚠️  Lambda function not found - check REMOTION_APP_FUNCTION_NAME');
      } else if (error.message.includes('AccessDenied')) {
        console.error('   ⚠️  AWS IAM permissions issue - check Lambda invoke permissions');
      }
    } else {
      console.error('   Raw error:', JSON.stringify(error, null, 2));
    }
    // Try to mark patch note with error
    try {
      await supabase
        .from('patch_notes')
        .update({ 
          processing_progress: 100,
          processing_error: error instanceof Error ? error.message : 'Unknown video rendering error'
        })
        .eq('id', patchNoteId);
    } catch (dbError) {
      console.error('❌ Failed to update DB with video error:', dbError);
    }
    throw error;
  }
}
