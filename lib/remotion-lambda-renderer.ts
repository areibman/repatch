import { renderMediaOnLambda, getRenderProgress, AwsRegion } from '@remotion/lambda/client';
import { createServiceSupabaseClient } from '@/lib/supabase';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const REMOTION_APP_FUNCTION_NAME = process.env.REMOTION_APP_FUNCTION_NAME || 'remotion-render-4-0-355-mem2048mb-disk2048mb-300sec';
const REMOTION_APP_SERVE_URL = process.env.REMOTION_APP_SERVE_URL || 'https://remotionlambda-useast1-slzcsqmp1p.s3.us-east-1.amazonaws.com/sites/repatch-video-renderer/index.html';

/**
 * Starts a video render job on Remotion Lambda
 * Returns immediately with render job information for polling
 * 
 * PREREQUISITE: video_data or video_top_changes must already be in the database
 */
export async function startVideoRender(patchNoteId: string) {
  console.log('🎬 Starting Lambda video render for patch note:', patchNoteId);
  
  const supabase = createServiceSupabaseClient();

  // Validate environment variables
  const missingVars: string[] = [];
  if (!AWS_REGION) missingVars.push('AWS_REGION');
  if (!process.env.AWS_ACCESS_KEY_ID) missingVars.push('AWS_ACCESS_KEY_ID');
  if (!process.env.AWS_SECRET_ACCESS_KEY) missingVars.push('AWS_SECRET_ACCESS_KEY');
  if (!REMOTION_APP_FUNCTION_NAME) missingVars.push('REMOTION_APP_FUNCTION_NAME');
  if (!REMOTION_APP_SERVE_URL) missingVars.push('REMOTION_APP_SERVE_URL');
  
  if (missingVars.length > 0) {
    const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}`;
    console.error('❌', errorMsg);
    
    await supabase
      .from('patch_notes')
      .update({ 
        processing_status: 'failed',
        processing_error: errorMsg
      })
      .eq('id', patchNoteId);
    
    throw new Error(errorMsg);
  }

  // Fetch ONLY the video data we need - no AI processing here
  const { data: patchNote, error: fetchError } = await supabase
    .from('patch_notes')
    .select('repo_name, video_data, video_top_changes, ai_detailed_contexts, ai_summaries')
    .eq('id', patchNoteId)
    .single();

  if (fetchError || !patchNote) {
    console.error('❌ Failed to fetch patch note:', fetchError);
    throw new Error('Failed to fetch patch note');
  }

  // Build video input data from what's already in the database
  let topChanges = null;
  let allChanges: string[] = [];

  // Priority 1: Use video_top_changes if available (manually edited or pre-generated)
  if (patchNote.video_top_changes && Array.isArray(patchNote.video_top_changes) && patchNote.video_top_changes.length > 0) {
    console.log('✅ Using video_top_changes from DB:', patchNote.video_top_changes.length);
    topChanges = patchNote.video_top_changes;
  }
  // Priority 2: Use video_data if available
  else if (patchNote.video_data && typeof patchNote.video_data === 'object') {
    const vd = patchNote.video_data as any;
    if (vd.topChanges && Array.isArray(vd.topChanges) && vd.topChanges.length > 0) {
      console.log('✅ Using video_data.topChanges from DB:', vd.topChanges.length);
      topChanges = vd.topChanges;
    }
  }

  if (!topChanges || topChanges.length === 0) {
    const errorMsg = 'No video data found. Process route must generate video_data or video_top_changes first.';
    console.error('❌', errorMsg);
    throw new Error(errorMsg);
  }

  // Build allChanges from ai_detailed_contexts or ai_summaries
  if (patchNote.ai_detailed_contexts && Array.isArray(patchNote.ai_detailed_contexts) && patchNote.ai_detailed_contexts.length > 0) {
    console.log('✅ Using ai_detailed_contexts for scrolling:', patchNote.ai_detailed_contexts.length);
    allChanges = patchNote.ai_detailed_contexts.map((ctx: any) => {
      const commitTitle = ctx.message?.split("\n")[0] || 'Change';
      return `${commitTitle}\n${ctx.context || ctx.message}`;
    });
  } else if (patchNote.ai_summaries && Array.isArray(patchNote.ai_summaries) && patchNote.ai_summaries.length > 0) {
    console.log('✅ Using ai_summaries for scrolling:', patchNote.ai_summaries.length);
    allChanges = patchNote.ai_summaries.map((summary: any) => {
      const commitTitle = summary.message?.split("\n")[0] || 'Change';
      return `${commitTitle}\n${summary.aiSummary || summary.message}`;
    });
  }

  const videoInputData = {
    langCode: 'en',
    topChanges,
    allChanges,
  };

  console.log('📹 Video input ready:');
  console.log('   - Top changes:', topChanges.length);
  console.log('   - All changes:', allChanges.length);

  try {
    // Trigger Lambda render (doesn't wait for completion)
    const renderResponse = await renderMediaOnLambda({
      region: AWS_REGION as AwsRegion,
      functionName: REMOTION_APP_FUNCTION_NAME,
      serveUrl: REMOTION_APP_SERVE_URL,
      composition: 'basecomp',
      inputProps: {
        repositorySlug: patchNote.repo_name || 'repository',
        releaseTag: 'Latest Update',
        openaiGeneration: videoInputData,
        ...videoInputData,
      },
      codec: 'h264',
      imageFormat: 'jpeg',
      maxRetries: 1,
      privacy: 'public',
    });

    console.log('✅ Lambda render initiated!');
    console.log('   - Render ID:', renderResponse.renderId);
    console.log('   - Bucket:', renderResponse.bucketName);

    // Store render job info in database
    const { error: updateError } = await supabase
      .from('patch_notes')
      .update({ 
        video_render_id: renderResponse.renderId,
        video_bucket_name: renderResponse.bucketName,
        processing_status: 'generating_video',
        processing_error: null
      })
      .eq('id', patchNoteId);

    if (updateError) {
      console.error('❌ Failed to update database with render info:', updateError);
      throw new Error('Failed to update database');
    }

    return {
      renderId: renderResponse.renderId,
      bucketName: renderResponse.bucketName
    };
  } catch (error) {
    console.error('❌ Failed to start Lambda render:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await supabase
      .from('patch_notes')
      .update({ 
        processing_status: 'failed',
        processing_error: `Video render failed to start: ${errorMessage}`
      })
      .eq('id', patchNoteId);
    
    throw error;
  }
}

/**
 * Checks the status of a video render job
 * Returns progress and completion status
 */
export async function getVideoRenderStatus(patchNoteId: string) {
  console.log('🔍 Checking video render status for:', patchNoteId);
  
  const supabase = createServiceSupabaseClient();

  // Get render job info from database
  const { data: patchNote, error: fetchError } = await supabase
    .from('patch_notes')
    .select('video_render_id, video_bucket_name, video_url, processing_status, processing_error')
    .eq('id', patchNoteId)
    .single();

  if (fetchError || !patchNote) {
    console.error('❌ Failed to fetch patch note:', fetchError);
    return {
      status: 'failed' as const,
      progress: 0,
      error: 'Patch note not found'
    };
  }

  // Check if already completed
  if (patchNote.video_url) {
    console.log('✅ Video already completed');
    return {
      status: 'completed' as const,
      progress: 100,
      videoUrl: patchNote.video_url
    };
  }

  // Check if failed
  if (patchNote.processing_status === 'failed') {
    console.log('❌ Render marked as failed');
    return {
      status: 'failed' as const,
      progress: 0,
      error: patchNote.processing_error || 'Video rendering failed'
    };
  }

  // Check if render job exists
  if (!patchNote.video_render_id || !patchNote.video_bucket_name) {
    console.log('⚠️  No render job found');
    return {
      status: 'pending' as const,
      progress: 0,
      error: 'No render job initiated'
    };
  }

  try {
    // Get progress from Lambda
    const progress = await getRenderProgress({
      region: AWS_REGION as AwsRegion,
      functionName: REMOTION_APP_FUNCTION_NAME,
      bucketName: patchNote.video_bucket_name,
      renderId: patchNote.video_render_id,
    });

    const progressPercent = Math.round((progress.overallProgress || 0) * 100);
    console.log(`   Progress: ${progressPercent}%`);

    // Check if render failed
    if (progress.fatalErrorEncountered) {
      const errorMsg = progress.errors?.[0]?.message || 'Unknown render error';
      console.error('❌ Render failed:', errorMsg);
      
      await supabase
        .from('patch_notes')
        .update({ 
          processing_status: 'failed',
          processing_error: `Video render failed: ${errorMsg}`,
          video_render_id: null,
          video_bucket_name: null
        })
        .eq('id', patchNoteId);
      
      return {
        status: 'failed' as const,
        progress: progressPercent,
        error: errorMsg
      };
    }

    // Check if render completed
    if (progress.done && progress.outputFile) {
      console.log('✅ Render completed!');
      console.log('   - Output file:', progress.outputFile);

      // Construct video URL
      let videoUrl: string;
      if (progress.outputFile.startsWith('http://') || progress.outputFile.startsWith('https://')) {
        videoUrl = progress.outputFile;
      } else {
        videoUrl = `https://${patchNote.video_bucket_name}.s3.${AWS_REGION}.amazonaws.com/${progress.outputFile}`;
      }

      console.log('📝 Video URL:', videoUrl);

      // Update database with completed video
      const { error: updateError } = await supabase
        .from('patch_notes')
        .update({ 
          video_url: videoUrl,
          processing_status: 'completed',
          video_render_id: null,
          video_bucket_name: null
        })
        .eq('id', patchNoteId);

      if (updateError) {
        console.error('❌ Failed to update database with video URL:', updateError);
      }

      return {
        status: 'completed' as const,
        progress: 100,
        videoUrl
      };
    }

    // Still rendering
    return {
      status: 'rendering' as const,
      progress: progressPercent
    };
  } catch (error) {
    console.error('❌ Failed to check render status:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      status: 'failed' as const,
      progress: 0,
      error: `Failed to check render status: ${errorMessage}`
    };
  }
}
