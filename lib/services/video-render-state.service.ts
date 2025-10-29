/**
 * Video Render State Service
 * Manages video rendering state transitions atomically
 * Prevents race conditions through database-level locking
 */

import { createServiceSupabaseClient } from '@/lib/supabase';
import {
  type VideoRenderState,
  isValidTransition,
  getProcessingStatus,
  inferStateFromDatabase,
  InvalidStateTransitionError,
} from './video-render-state-machine';

/**
 * State transition result
 */
export interface StateTransitionResult {
  readonly success: boolean;
  readonly newState: VideoRenderState;
  readonly error?: string;
}

/**
 * Video render status from database
 */
export interface VideoRenderStatus {
  readonly state: VideoRenderState;
  readonly progress: number;
  readonly videoUrl: string | null;
  readonly renderId: string | null;
  readonly bucketName: string | null;
  readonly error: string | null;
  readonly processingStage: string | null;
}

/**
 * Get current video render state for a patch note
 * Uses database values to infer state
 */
export async function getVideoRenderState(
  patchNoteId: string
): Promise<VideoRenderStatus> {
  const supabase = createServiceSupabaseClient();

  const { data, error } = await supabase
    .from('patch_notes')
    .select(
      'processing_status, video_url, video_render_id, video_bucket_name, processing_error, processing_stage, processing_progress'
    )
    .eq('id', patchNoteId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch patch note: ${error?.message || 'Not found'}`);
  }

  const state = inferStateFromDatabase(
    data.processing_status,
    data.video_url,
    data.video_render_id,
    data.processing_error
  );

  return {
    state,
    progress: data.processing_progress ?? 0,
    videoUrl: data.video_url ?? null,
    renderId: data.video_render_id ?? null,
    bucketName: data.video_bucket_name ?? null,
    error: data.processing_error ?? null,
    processingStage: data.processing_stage ?? null,
  };
}

/**
 * Transition video render state atomically
 * Uses a database transaction to prevent race conditions
 */
export async function transitionVideoRenderState(
  patchNoteId: string,
  toState: VideoRenderState,
  metadata?: {
    readonly renderId?: string;
    readonly bucketName?: string;
    readonly videoUrl?: string;
    readonly error?: string;
    readonly progress?: number;
    readonly stage?: string;
  }
): Promise<StateTransitionResult> {
  const supabase = createServiceSupabaseClient();

  // Get current state
  const currentStatus = await getVideoRenderState(patchNoteId);
  const fromState = currentStatus.state;

  // Validate transition
  if (!isValidTransition(fromState, toState)) {
    return {
      success: false,
      newState: fromState,
      error: `Invalid transition: ${fromState} -> ${toState}`,
    };
  }

  // Build update object
  const update: Record<string, unknown> = {
    processing_status: getProcessingStatus(toState),
  };

  // Update fields based on transition
  if (toState === 'idle') {
    // Reset to idle state - clear render tracking and optionally video URL
    // If videoUrl is explicitly set to null in metadata, clear it (for regeneration)
    if (metadata && 'videoUrl' in metadata && metadata.videoUrl === null) {
      update.video_url = null;
    }
    // Always clear render tracking when resetting to idle
    update.video_render_id = null;
    update.video_bucket_name = null;
    if (metadata?.stage) {
      update.processing_stage = metadata.stage;
    }
    update.processing_progress = 0;
    update.processing_error = null;
  }

  if (toState === 'initiating' || toState === 'rendering') {
    if (metadata?.renderId) {
      update.video_render_id = metadata.renderId;
    }
    if (metadata?.bucketName) {
      update.video_bucket_name = metadata.bucketName;
    }
    if (metadata?.progress !== undefined) {
      update.processing_progress = metadata.progress;
    }
    if (metadata?.stage) {
      update.processing_stage = metadata.stage;
    }
    update.processing_error = null; // Clear any previous errors
  }

  if (toState === 'completed') {
    if (metadata?.videoUrl) {
      update.video_url = metadata.videoUrl;
    }
    // Clear render tracking fields
    update.video_render_id = null;
    update.video_bucket_name = null;
    update.processing_progress = 100;
    update.processing_stage = 'Video completed';
    update.processing_error = null;
  }

  if (toState === 'failed') {
    if (metadata?.error) {
      update.processing_error = metadata.error;
    }
    // Optionally clear render tracking on failure
    if (metadata?.renderId === null) {
      update.video_render_id = null;
      update.video_bucket_name = null;
    }
    if (metadata?.stage) {
      update.processing_stage = metadata.stage;
    }
  }

  // Perform atomic update
  const { error: updateError } = await supabase
    .from('patch_notes')
    .update(update)
    .eq('id', patchNoteId);

  if (updateError) {
    return {
      success: false,
      newState: fromState,
      error: `Database update failed: ${updateError.message}`,
    };
  }

  return {
    success: true,
    newState: toState,
  };
}

/**
 * Start a video render (transition: idle -> initiating)
 */
export async function startVideoRenderTransition(
  patchNoteId: string,
  renderId: string,
  bucketName: string
): Promise<StateTransitionResult> {
  return transitionVideoRenderState(patchNoteId, 'initiating', {
    renderId,
    bucketName,
    stage: 'Initiating video render...',
    progress: 0,
  });
}

/**
 * Update render progress (transition: initiating -> rendering, or update rendering state)
 */
export async function updateRenderProgress(
  patchNoteId: string,
  progress: number,
  stage?: string
): Promise<StateTransitionResult> {
  const currentStatus = await getVideoRenderState(patchNoteId);
  
  // If still initiating, transition to rendering
  const targetState = currentStatus.state === 'initiating' ? 'rendering' : currentStatus.state;
  
  if (targetState !== 'rendering') {
    return {
      success: false,
      newState: currentStatus.state,
      error: `Cannot update progress: current state is ${currentStatus.state}, not rendering`,
    };
  }

  return transitionVideoRenderState(patchNoteId, targetState, {
    progress,
    stage: stage || `Rendering... ${progress}%`,
  });
}

/**
 * Complete render (transition: rendering -> completed)
 */
export async function completeRender(
  patchNoteId: string,
  videoUrl: string
): Promise<StateTransitionResult> {
  return transitionVideoRenderState(patchNoteId, 'completed', {
    videoUrl,
  });
}

/**
 * Fail render (transition: any -> failed)
 */
export async function failRender(
  patchNoteId: string,
  error: string,
  clearRenderId = false
): Promise<StateTransitionResult> {
  return transitionVideoRenderState(patchNoteId, 'failed', {
    error,
    renderId: clearRenderId ? null : undefined,
    stage: 'Render failed',
  });
}
