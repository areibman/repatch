import { renderMediaOnLambda, getRenderProgress, AwsRegion } from '@remotion/lambda/client';
import { createServiceSupabaseClient } from '@/lib/supabase';
import {
  startVideoRenderTransition,
  updateRenderProgress,
  completeRender,
  failRender,
  getVideoRenderState,
} from '@/lib/services/video-render-state.service';

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
    
    await failRender(patchNoteId, errorMsg);
    
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

  // Build video input data from what's already in the database (functional, immutable)
  type VideoChange = { readonly title: string; readonly description: string };
  type VideoData = { readonly topChanges?: readonly VideoChange[] };
  type DetailedContext = { readonly message?: string; readonly context?: string };
  type AiSummary = { readonly message?: string; readonly aiSummary?: string };

  /**
   * Extract top changes from video_top_changes or video_data
   */
  const extractTopChanges = (): readonly VideoChange[] | null => {
    // Priority 1: Use video_top_changes if available
    if (patchNote.video_top_changes && Array.isArray(patchNote.video_top_changes) && patchNote.video_top_changes.length > 0) {
      console.log('✅ Using video_top_changes from DB:', patchNote.video_top_changes.length);
      return patchNote.video_top_changes as unknown as readonly VideoChange[];
    }
    
    // Priority 2: Use video_data if available
    if (patchNote.video_data && typeof patchNote.video_data === 'object') {
      const videoData = patchNote.video_data as VideoData;
      if (videoData.topChanges && Array.isArray(videoData.topChanges) && videoData.topChanges.length > 0) {
        console.log('✅ Using video_data.topChanges from DB:', videoData.topChanges.length);
        return videoData.topChanges;
      }
    }
    
    return null;
  };

  /**
   * Format detailed context into scrolling text
   */
  const formatDetailedContext = (ctx: DetailedContext): string => {
    const commitTitle = ctx.message?.split("\n")[0] || 'Change';
    return `${commitTitle}\n${ctx.context || ctx.message}`;
  };

  /**
   * Format AI summary into scrolling text
   */
  const formatAiSummary = (summary: AiSummary): string => {
    const commitTitle = summary.message?.split("\n")[0] || 'Change';
    return `${commitTitle}\n${summary.aiSummary || summary.message}`;
  };

  /**
   * Extract scrolling changes from ai_detailed_contexts or ai_summaries
   */
  const extractAllChanges = (): readonly string[] => {
    if (patchNote.ai_detailed_contexts && Array.isArray(patchNote.ai_detailed_contexts) && patchNote.ai_detailed_contexts.length > 0) {
      console.log('✅ Using ai_detailed_contexts for scrolling:', patchNote.ai_detailed_contexts.length);
      return (patchNote.ai_detailed_contexts as readonly DetailedContext[]).map(formatDetailedContext);
    }
    
    if (patchNote.ai_summaries && Array.isArray(patchNote.ai_summaries) && patchNote.ai_summaries.length > 0) {
      console.log('✅ Using ai_summaries for scrolling:', patchNote.ai_summaries.length);
      return (patchNote.ai_summaries as readonly AiSummary[]).map(formatAiSummary);
    }
    
    return [];
  };

  const topChanges = extractTopChanges();
  const allChanges = extractAllChanges();

  if (!topChanges || topChanges.length === 0) {
    const errorMsg = 'No video data found. Process route must generate video_data or video_top_changes first.';
    console.error('❌', errorMsg);
    throw new Error(errorMsg);
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

    // Transition state atomically using centralized state machine
    const transitionResult = await startVideoRenderTransition(
      patchNoteId,
      renderResponse.renderId,
      renderResponse.bucketName
    );

    if (!transitionResult.success) {
      console.error('❌ Failed to transition state:', transitionResult.error);
      throw new Error(`Failed to update state: ${transitionResult.error}`);
    }

    return {
      renderId: renderResponse.renderId,
      bucketName: renderResponse.bucketName
    };
  } catch (error) {
    console.error('❌ Failed to start Lambda render:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await failRender(patchNoteId, `Video render failed to start: ${errorMessage}`);
    
    throw error;
  }
}

/**
 * Checks the status of a video render job
 * Returns progress and completion status
 * Uses centralized state machine for consistent state management
 */
export async function getVideoRenderStatus(patchNoteId: string) {
  console.log('🔍 Checking video render status for:', patchNoteId);

  try {
    // Get current state from centralized state machine
    const currentStatus = await getVideoRenderState(patchNoteId);

    // If already completed, return immediately
    if (currentStatus.state === 'completed') {
      console.log('✅ Video already completed');
      return {
        status: 'completed' as const,
        progress: 100,
        videoUrl: currentStatus.videoUrl || undefined
      };
    }

    // If failed, return error
    if (currentStatus.state === 'failed') {
      console.log('❌ Render marked as failed');
      return {
        status: 'failed' as const,
        progress: currentStatus.progress,
        error: currentStatus.error || 'Video rendering failed'
      };
    }

    // If idle, no render job initiated
    if (currentStatus.state === 'idle') {
      console.log('⚠️  No render job found');
      return {
        status: 'pending' as const,
        progress: 0,
        error: 'No render job initiated'
      };
    }

    // For initiating or rendering states, check Lambda progress
    if (!currentStatus.renderId || !currentStatus.bucketName) {
      console.log('⚠️  Render ID or bucket missing');
      return {
        status: 'pending' as const,
        progress: 0,
        error: 'Render job not properly initialized'
      };
    }

    // Get progress from Lambda
    const progress = await getRenderProgress({
      region: AWS_REGION as AwsRegion,
      functionName: REMOTION_APP_FUNCTION_NAME,
      bucketName: currentStatus.bucketName,
      renderId: currentStatus.renderId,
    });

    const progressPercent = Math.round((progress.overallProgress || 0) * 100);
    console.log(`   Progress: ${progressPercent}%`);

    // Check if render failed
    if (progress.fatalErrorEncountered) {
      const errorMsg = progress.errors?.[0]?.message || 'Unknown render error';
      console.error('❌ Render failed:', errorMsg);
      
      await failRender(patchNoteId, `Video render failed: ${errorMsg}`, true);
      
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

      // Construct video URL (functional, no mutation)
      const videoUrl = progress.outputFile.startsWith('http://') || progress.outputFile.startsWith('https://')
        ? progress.outputFile
        : `https://${currentStatus.bucketName}.s3.${AWS_REGION}.amazonaws.com/${progress.outputFile}`;

      console.log('📝 Video URL:', videoUrl);

      // Transition to completed state atomically
      const transitionResult = await completeRender(patchNoteId, videoUrl);

      if (!transitionResult.success) {
        console.error('❌ Failed to transition to completed:', transitionResult.error);
        // Still return success since render is done
      }

      return {
        status: 'completed' as const,
        progress: 100,
        videoUrl
      };
    }

    // Still rendering - update progress in state machine
    if (currentStatus.state === 'initiating' || currentStatus.state === 'rendering') {
      await updateRenderProgress(patchNoteId, progressPercent);
    }

    return {
      status: 'rendering' as const,
      progress: progressPercent
    };
  } catch (error) {
    console.error('❌ Failed to check render status:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Try to update state to failed
    try {
      await failRender(patchNoteId, `Failed to check render status: ${errorMessage}`);
    } catch (updateError) {
      console.error('❌ Failed to update error state:', updateError);
    }
    
    return {
      status: 'failed' as const,
      progress: 0,
      error: errorMessage
    };
  }
}
