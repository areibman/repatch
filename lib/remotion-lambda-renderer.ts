import { renderMediaOnLambda, getRenderProgress, AwsRegion } from '@remotion/lambda/client';
import {
  startVideoRenderTransition,
  completeVideoRender,
  failVideoRender,
  markRenderStarted,
  getVideoRenderStatus as getVideoRenderStatusFromState,
  type VideoRenderStatus,
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
    
    await failVideoRender(patchNoteId, errorMsg);
    
    throw new Error(errorMsg);
  }

  // Fetch ONLY the video data we need - no AI processing here
  const supabase = createServiceSupabaseClient();
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

    // Use state machine to transition to queued state
    const transitionResult = await startVideoRenderTransition(
      patchNoteId,
      renderResponse.renderId,
      renderResponse.bucketName
    );

    if (!transitionResult.success) {
      console.error('❌ Failed to transition state:', transitionResult.error);
      throw new Error(`Failed to update state: ${transitionResult.error}`);
    }

    // Mark as started (queued -> rendering)
    await markRenderStarted(patchNoteId);

    return {
      renderId: renderResponse.renderId,
      bucketName: renderResponse.bucketName
    };
  } catch (error) {
    console.error('❌ Failed to start Lambda render:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await failVideoRender(patchNoteId, `Video render failed to start: ${errorMessage}`);
    
    throw error;
  }
}

/**
 * Checks the status of a video render job
 * Returns progress and completion status
 * Uses centralized state machine for consistent status reporting
 */
export async function checkVideoRenderStatus(patchNoteId: string): Promise<{
  status: 'idle' | 'queued' | 'rendering' | 'completed' | 'failed';
  progress: number;
  videoUrl?: string;
  error?: string;
}> {
  console.log('🔍 Checking video render status for:', patchNoteId);

  // Get current status from state machine
  const status = await getVideoRenderStatusFromState(patchNoteId);

  // If already completed or failed, return immediately
  if (status.state === 'completed') {
    return {
      status: 'completed',
      progress: 100,
      videoUrl: status.videoUrl || undefined,
    };
  }

  if (status.state === 'failed') {
    return {
      status: 'failed',
      progress: 0,
      error: status.error || 'Video rendering failed',
    };
  }

  // If idle or queued, no Lambda check needed
  if (status.state === 'idle' || status.state === 'queued') {
    return {
      status: status.state,
      progress: status.progress,
      error: status.error || undefined,
    };
  }

  // For rendering state, check Lambda progress
  if (status.state === 'rendering' && status.renderId && status.bucketName) {
    try {
      const progress = await getRenderProgress({
        region: AWS_REGION as AwsRegion,
        functionName: REMOTION_APP_FUNCTION_NAME,
        bucketName: status.bucketName,
        renderId: status.renderId,
      });

      const progressPercent = Math.round((progress.overallProgress || 0) * 100);
      console.log(`   Progress: ${progressPercent}%`);

      // Check if render failed
      if (progress.fatalErrorEncountered) {
        const errorMsg = progress.errors?.[0]?.message || 'Unknown render error';
        console.error('❌ Render failed:', errorMsg);

        await failVideoRender(patchNoteId, `Video render failed: ${errorMsg}`);

        return {
          status: 'failed',
          progress: progressPercent,
          error: errorMsg,
        };
      }

      // Check if render completed
      if (progress.done && progress.outputFile) {
        console.log('✅ Render completed!');
        console.log('   - Output file:', progress.outputFile);

        // Construct video URL
        const videoUrl =
          progress.outputFile.startsWith('http://') ||
          progress.outputFile.startsWith('https://')
            ? progress.outputFile
            : `https://${status.bucketName}.s3.${AWS_REGION}.amazonaws.com/${progress.outputFile}`;

        console.log('📝 Video URL:', videoUrl);

        // Use state machine to transition to completed
        await completeVideoRender(patchNoteId, videoUrl);

        return {
          status: 'completed',
          progress: 100,
          videoUrl,
        };
      }

      // Still rendering - return current progress
      return {
        status: 'rendering',
        progress: progressPercent,
      };
    } catch (error) {
      console.error('❌ Failed to check render status:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Don't fail the render on check errors - might be transient
      return {
        status: 'rendering',
        progress: status.progress,
        error: `Failed to check render status: ${errorMessage}`,
      };
    }
  }

  // Fallback
  return {
    status: status.state,
    progress: status.progress,
    error: status.error || undefined,
  };
}

/**
 * Legacy function name for backwards compatibility
 * @deprecated Use checkVideoRenderStatus instead
 */
export async function getVideoRenderStatus(patchNoteId: string) {
  const result = await checkVideoRenderStatus(patchNoteId);
  // Map new status values to legacy ones
  const statusMap: Record<string, 'pending' | 'rendering' | 'completed' | 'failed'> = {
    idle: 'pending',
    queued: 'pending',
    rendering: 'rendering',
    completed: 'completed',
    failed: 'failed',
  };
  return {
    status: statusMap[result.status] || 'pending',
    progress: result.progress,
    videoUrl: result.videoUrl,
    error: result.error,
  };
}
