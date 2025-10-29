/**
 * Video Render State Machine
 * Centralized state management for video rendering lifecycle
 * 
 * States:
 * - pending: Initial state, no render started
 * - generating_video: Render job initiated, waiting for completion
 * - rendering: Active render in progress (polling Lambda)
 * - completed: Video successfully rendered and stored
 * - failed: Render failed at any stage
 * 
 * Valid Transitions:
 * - pending -> generating_video (when render starts)
 * - generating_video -> rendering (when Lambda reports progress)
 * - generating_video -> completed (when Lambda completes immediately)
 * - generating_video -> failed (when render fails to start)
 * - rendering -> completed (when render succeeds)
 * - rendering -> failed (when render fails)
 * - any -> failed (error can occur from any state)
 */

import { createServiceSupabaseClient } from '@/lib/supabase';

/**
 * Video render states matching the database enum
 */
export type VideoRenderStatus =
  | 'pending'
  | 'generating_video'
  | 'rendering'
  | 'completed'
  | 'failed';

/**
 * Database processing status (includes all processing stages)
 */
export type ProcessingStatus =
  | 'pending'
  | 'fetching_stats'
  | 'analyzing_commits'
  | 'generating_content'
  | 'generating_video'
  | 'completed'
  | 'failed';

/**
 * Valid state transitions map
 * Note: 'failed' can be reached from any non-terminal state for error handling
 */
const VALID_TRANSITIONS: Record<VideoRenderStatus, readonly VideoRenderStatus[]> = {
  pending: ['generating_video', 'failed'],
  generating_video: ['rendering', 'completed', 'failed'],
  rendering: ['completed', 'failed'],
  completed: [], // Terminal state - no transitions allowed
  failed: ['generating_video', 'failed'], // Allow retry from failed, or re-fail on error
} as const;

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  from: VideoRenderStatus,
  to: VideoRenderStatus
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Video render status update data
 */
export interface VideoRenderStatusUpdate {
  readonly processing_status: ProcessingStatus;
  readonly processing_stage?: string | null;
  readonly processing_error?: string | null;
  readonly processing_progress?: number | null;
  readonly video_render_id?: string | null;
  readonly video_bucket_name?: string | null;
  readonly video_url?: string | null;
}

/**
 * Get current video render status from database
 */
export async function getCurrentVideoRenderStatus(
  patchNoteId: string
): Promise<{
  readonly status: VideoRenderStatus;
  readonly videoUrl?: string | null;
  readonly renderId?: string | null;
  readonly bucketName?: string | null;
  readonly error?: string | null;
}> {
  const supabase = createServiceSupabaseClient();

  const { data, error } = await supabase
    .from('patch_notes')
    .select('processing_status, video_url, video_render_id, video_bucket_name, processing_error')
    .eq('id', patchNoteId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch video render status: ${error?.message || 'Not found'}`);
  }

  // Normalize status: if video_url exists, we're completed regardless of status
  let status: VideoRenderStatus = (data.processing_status as VideoRenderStatus) || 'pending';
  
  if (data.video_url) {
    status = 'completed';
  } else if (data.processing_status === 'generating_video' && data.video_render_id) {
    // If we have a render ID, we're actually rendering (not just generating)
    status = 'rendering';
  }

  return {
    status,
    videoUrl: data.video_url,
    renderId: data.video_render_id || null,
    bucketName: data.video_bucket_name || null,
    error: data.processing_error || null,
  };
}

/**
 * Transition video render status with validation
 * Automatically determines current state from database
 * Throws error if transition is invalid
 */
export async function transitionVideoRenderStatus(
  patchNoteId: string,
  to: VideoRenderStatus,
  metadata?: {
    readonly stage?: string;
    readonly error?: string;
    readonly progress?: number;
    readonly renderId?: string;
    readonly bucketName?: string;
    readonly videoUrl?: string;
  }
): Promise<void> {
  // Get current status from database
  const current = await getCurrentVideoRenderStatus(patchNoteId);
  const from = current.status;

  // Validate transition (allow failed from any state for error handling)
  if (to !== 'failed' && !isValidTransition(from, to)) {
    throw new Error(
      `Invalid state transition: ${from} -> ${to}. Valid transitions: ${VALID_TRANSITIONS[from].join(', ')}`
    );
  }

  const supabase = createServiceSupabaseClient();

  // Build update object
  const update: VideoRenderStatusUpdate = {
    processing_status: to,
    ...(metadata?.stage !== undefined && { processing_stage: metadata.stage }),
    ...(metadata?.error !== undefined && { processing_error: metadata.error }),
    ...(metadata?.error === null && { processing_error: null }),
    ...(metadata?.progress !== undefined && { processing_progress: metadata.progress }),
    ...(metadata?.renderId !== undefined && { video_render_id: metadata.renderId }),
    ...(metadata?.bucketName !== undefined && { video_bucket_name: metadata.bucketName }),
    ...(metadata?.videoUrl !== undefined && { video_url: metadata.videoUrl }),
  };

  // If transitioning to completed, clear render tracking
  if (to === 'completed') {
    update.video_render_id = null;
    update.video_bucket_name = null;
    update.processing_stage = null;
    update.processing_progress = null;
  }

  // If transitioning to failed, clear render tracking
  if (to === 'failed') {
    update.video_render_id = null;
    update.video_bucket_name = null;
  }

  const { error } = await supabase
    .from('patch_notes')
    .update(update)
    .eq('id', patchNoteId);

  if (error) {
    throw new Error(`Failed to update video render status: ${error.message}`);
  }

  console.log(`✅ Video render status transition: ${from} -> ${to}`, {
    patchNoteId,
    ...(metadata?.stage && { stage: metadata.stage }),
    ...(metadata?.progress !== undefined && { progress: metadata.progress }),
  });
}

/**
 * Get current video render status from database
 */
export async function getCurrentVideoRenderStatus(
  patchNoteId: string
): Promise<{
  readonly status: VideoRenderStatus;
  readonly videoUrl?: string | null;
  readonly renderId?: string | null;
  readonly bucketName?: string | null;
  readonly error?: string | null;
}> {
  const supabase = createServiceSupabaseClient();

  const { data, error } = await supabase
    .from('patch_notes')
    .select('processing_status, video_url, video_render_id, video_bucket_name, processing_error')
    .eq('id', patchNoteId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch video render status: ${error?.message || 'Not found'}`);
  }

  // Normalize status: if video_url exists, we're completed regardless of status
  let status: VideoRenderStatus = (data.processing_status as VideoRenderStatus) || 'pending';
  
  if (data.video_url) {
    status = 'completed';
  } else if (data.processing_status === 'generating_video' && data.video_render_id) {
    // If we have a render ID, we're actually rendering (not just generating)
    status = 'rendering';
  }

  return {
    status,
    videoUrl: data.video_url,
    renderId: data.video_render_id || null,
    bucketName: data.video_bucket_name || null,
    error: data.processing_error || null,
  };
}

/**
 * Transition to generating_video (render started)
 */
export async function startVideoRenderTransition(
  patchNoteId: string,
  renderId: string,
  bucketName: string
): Promise<void> {
  await transitionVideoRenderStatus(patchNoteId, 'generating_video', {
    renderId,
    bucketName,
    stage: 'Preparing video render...',
    error: null,
  });
}

/**
 * Transition to rendering (Lambda reports progress)
 */
export async function updateVideoRenderProgress(
  patchNoteId: string,
  progress: number
): Promise<void> {
  const current = await getCurrentVideoRenderStatus(patchNoteId);
  
  // Transition from generating_video to rendering on first progress update
  if (current.status === 'generating_video') {
    await transitionVideoRenderStatus(patchNoteId, 'rendering', {
      progress,
      stage: `Rendering video... ${progress}%`,
    });
  } else if (current.status === 'rendering') {
    // Update progress without changing state
    const supabase = createServiceSupabaseClient();
    await supabase
      .from('patch_notes')
      .update({
        processing_progress: progress,
        processing_stage: `Rendering video... ${progress}%`,
      })
      .eq('id', patchNoteId);
  }
}

/**
 * Transition to completed (render succeeded)
 */
export async function completeVideoRenderTransition(
  patchNoteId: string,
  videoUrl: string
): Promise<void> {
  await transitionVideoRenderStatus(patchNoteId, 'completed', {
    videoUrl,
    stage: null,
    progress: null,
    error: null,
  });
}

/**
 * Transition to failed (render failed)
 */
export async function failVideoRenderTransition(
  patchNoteId: string,
  error: string
): Promise<void> {
  await transitionVideoRenderStatus(patchNoteId, 'failed', {
    error,
    renderId: null,
    bucketName: null,
  });
}

/**
 * Reset video render (clear video and prepare for new render)
 */
export async function resetVideoRender(patchNoteId: string): Promise<void> {
  const supabase = createServiceSupabaseClient();
  
  await supabase
    .from('patch_notes')
    .update({
      video_url: null,
      video_render_id: null,
      video_bucket_name: null,
      processing_error: null,
      processing_progress: null,
      processing_stage: 'Preparing video render...',
      processing_status: 'generating_video',
    })
    .eq('id', patchNoteId);
}
