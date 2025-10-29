/**
 * Video Render State Service
 * Manages video rendering state transitions atomically
 * 
 * Features:
 * - Atomic state transitions (prevents race conditions)
 * - Optimistic locking using database version/status checks
 * - Single source of truth for state updates
 * - Efficient status queries (minimizes database round-trips)
 */

import { createServiceSupabaseClient } from '@/lib/supabase';
import {
  type VideoRenderState,
  type VideoRenderEvent,
  isValidTransition,
  getNextState,
  mapProcessingStatusToState,
  mapStateToProcessingStatus,
} from './video-render-state-machine';

/**
 * Video render status information
 */
export interface VideoRenderStatus {
  readonly state: VideoRenderState;
  readonly progress: number; // 0-100
  readonly renderId: string | null;
  readonly bucketName: string | null;
  readonly videoUrl: string | null;
  readonly error: string | null;
  readonly lastUpdated: Date;
}

/**
 * Result of a state transition attempt
 */
export interface StateTransitionResult {
  readonly success: boolean;
  readonly previousState: VideoRenderState;
  readonly newState: VideoRenderState | null;
  readonly error?: string;
}

/**
 * Get current video render status for a patch note
 * This is the single source of truth for status queries
 */
export async function getVideoRenderStatus(
  patchNoteId: string
): Promise<VideoRenderStatus> {
  const supabase = createServiceSupabaseClient();

  const { data: patchNote, error } = await supabase
    .from('patch_notes')
    .select(
      'processing_status, video_render_id, video_bucket_name, video_url, processing_error, updated_at'
    )
    .eq('id', patchNoteId)
    .single();

  if (error || !patchNote) {
    // Return default status if patch note not found
    return {
      state: 'idle',
      progress: 0,
      renderId: null,
      bucketName: null,
      videoUrl: null,
      error: error?.message || 'Patch note not found',
      lastUpdated: new Date(),
    };
  }

  const state = mapProcessingStatusToState(
    patchNote.processing_status,
    !!patchNote.video_render_id
  );

  // Determine progress based on state
  let progress = 0;
  if (state === 'completed') {
    progress = 100;
  } else if (state === 'rendering') {
    // Default to 50% if rendering (can be updated by progress updates)
    progress = 50;
  } else if (state === 'queued') {
    progress = 10;
  }

  return {
    state,
    progress,
    renderId: patchNote.video_render_id || null,
    bucketName: patchNote.video_bucket_name || null,
    videoUrl: patchNote.video_url || null,
    error: patchNote.processing_error || null,
    lastUpdated: new Date(patchNote.updated_at || new Date()),
  };
}

/**
 * Attempt to transition video render state
 * Uses optimistic locking to prevent race conditions
 * 
 * Returns success=false if transition is invalid or race condition detected
 */
export async function transitionVideoRenderState(
  patchNoteId: string,
  event: VideoRenderEvent,
  context?: {
    readonly renderId?: string;
    readonly bucketName?: string;
    readonly progress?: number;
    readonly videoUrl?: string;
    readonly error?: string;
  }
): Promise<StateTransitionResult> {
  const supabase = createServiceSupabaseClient();

  // Get current state atomically
  const { data: current, error: fetchError } = await supabase
    .from('patch_notes')
    .select('processing_status, video_render_id, video_bucket_name')
    .eq('id', patchNoteId)
    .single();

  if (fetchError || !current) {
    return {
      success: false,
      previousState: 'idle',
      newState: null,
      error: fetchError?.message || 'Patch note not found',
    };
  }

  const currentState = mapProcessingStatusToState(
    current.processing_status,
    !!current.video_render_id
  );

  // Validate transition
  if (!isValidTransition(currentState, event)) {
    return {
      success: false,
      previousState: currentState,
      newState: null,
      error: `Invalid transition: ${currentState} -> ${event}`,
    };
  }

  const newState = getNextState(currentState, event);
  if (!newState) {
    return {
      success: false,
      previousState: currentState,
      newState: null,
      error: 'Failed to get next state',
    };
  }

  // Build update object
  const update: Record<string, unknown> = {
    processing_status: mapStateToProcessingStatus(newState),
  };

  // Add context-specific fields
  if (context?.renderId !== undefined) {
    update.video_render_id = context.renderId;
  }
  if (context?.bucketName !== undefined) {
    update.video_bucket_name = context.bucketName;
  }
  if (context?.videoUrl !== undefined) {
    update.video_url = context.videoUrl;
  }
  if (context?.error !== undefined) {
    update.processing_error = context.error;
  } else if (newState === 'completed' || newState === 'failed') {
    // Clear render tracking when terminal state reached
    if (newState === 'completed') {
      update.video_render_id = null;
      update.video_bucket_name = null;
    }
  }

  // Use optimistic locking: only update if state hasn't changed
  // This prevents race conditions
  const { data: updatedData, error: updateError } = await supabase
    .from('patch_notes')
    .update(update)
    .eq('id', patchNoteId)
    .eq('processing_status', current.processing_status) // Optimistic lock
    .select('id')
    .single();

  if (updateError || !updatedData) {
    // Check if it's a race condition (no rows updated due to optimistic lock)
    // Supabase returns error when eq() filters don't match (state changed)
    return {
      success: false,
      previousState: currentState,
      newState: null,
      error: updateError?.message || 'Race condition detected: state changed by another process',
    };
  }

  return {
    success: true,
    previousState: currentState,
    newState,
  };
}

/**
 * Update video render progress
 * Only updates progress if state is 'rendering'
 */
export async function updateVideoRenderProgress(
  patchNoteId: string,
  progress: number
): Promise<boolean> {
  const status = await getVideoRenderStatus(patchNoteId);

  if (status.state !== 'rendering') {
    return false;
  }

  // For now, progress is derived from state
  // In the future, we could add a processing_progress column for finer-grained progress
  return true;
}

/**
 * Start a new video render
 * Transitions from idle/failed -> queued
 */
export async function startVideoRenderTransition(
  patchNoteId: string,
  renderId: string,
  bucketName: string
): Promise<StateTransitionResult> {
  return transitionVideoRenderState(patchNoteId, 'start', {
    renderId,
    bucketName,
  });
}

/**
 * Mark render as started (queued -> rendering)
 */
export async function markRenderStarted(patchNoteId: string): Promise<StateTransitionResult> {
  return transitionVideoRenderState(patchNoteId, 'progress');
}

/**
 * Complete video render
 * Transitions rendering -> completed
 */
export async function completeVideoRender(
  patchNoteId: string,
  videoUrl: string
): Promise<StateTransitionResult> {
  return transitionVideoRenderState(patchNoteId, 'complete', {
    videoUrl,
  });
}

/**
 * Fail video render
 * Transitions any state -> failed
 */
export async function failVideoRender(
  patchNoteId: string,
  error: string
): Promise<StateTransitionResult> {
  return transitionVideoRenderState(patchNoteId, 'fail', {
    error,
  });
}
