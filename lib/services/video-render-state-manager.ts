/**
 * Video Render State Manager
 * Handles atomic state transitions with race condition prevention
 * Reduces database round-trips with optimistic updates
 */

import { createServiceSupabaseClient } from '@/lib/supabase';
import {
  isValidTransition,
  type VideoRenderState,
  getStateMetadata,
} from './video-render-state-machine';

/**
 * Result of a state transition attempt
 */
export interface StateTransitionResult {
  readonly success: boolean;
  readonly previousState: VideoRenderState | string | null;
  readonly newState: VideoRenderState | null;
  readonly error?: string;
}

/**
 * Additional fields that can be updated alongside state
 */
export interface StateUpdateFields {
  readonly processing_stage?: string | null;
  readonly processing_error?: string | null;
  readonly processing_progress?: number | null;
  readonly video_render_id?: string | null;
  readonly video_bucket_name?: string | null;
  readonly video_url?: string | null;
}

/**
 * Transition video render state atomically
 * Uses database constraints and optimistic locking to prevent race conditions
 * 
 * @param patchNoteId - The patch note ID
 * @param newState - The target state
 * @param additionalFields - Optional fields to update alongside state
 * @param expectedPreviousState - Optional: validate current state before transition
 */
export async function transitionVideoRenderState(
  patchNoteId: string,
  newState: VideoRenderState,
  additionalFields: StateUpdateFields = {},
  expectedPreviousState?: VideoRenderState | string | null
): Promise<StateTransitionResult> {
  const supabase = createServiceSupabaseClient();

  try {
    // First, fetch current state (with row-level locking via SELECT FOR UPDATE equivalent)
    // In Supabase/Postgres, we'll use a transaction-like approach
    const { data: current, error: fetchError } = await supabase
      .from('patch_notes')
      .select('processing_status, video_render_id, video_bucket_name, video_url')
      .eq('id', patchNoteId)
      .single();

    if (fetchError || !current) {
      return {
        success: false,
        previousState: null,
        newState: null,
        error: `Failed to fetch current state: ${fetchError?.message ?? 'Not found'}`,
      };
    }

    const currentState = current.processing_status as VideoRenderState | string | null;

    // Validate expected previous state if provided
    if (expectedPreviousState !== undefined && currentState !== expectedPreviousState) {
      return {
        success: false,
        previousState: currentState,
        newState: null,
        error: `State mismatch: expected ${expectedPreviousState}, got ${currentState}`,
      };
    }

    // Validate transition
    if (!isValidTransition(currentState, newState)) {
      const metadata = getStateMetadata(currentState);
      return {
        success: false,
        previousState: currentState,
        newState: null,
        error: `Invalid transition from ${currentState} (${metadata?.label ?? 'unknown'}) to ${newState}`,
      };
    }

    // Build update object
    // Map 'rendering' to 'generating_video' for database storage
    // (database enum doesn't have 'rendering', it's an internal state)
    const dbState = newState === 'rendering' ? 'generating_video' : newState;
    const update: Record<string, unknown> = {
      processing_status: dbState,
      ...additionalFields,
    };

    // If transitioning to completed and video_url is provided, ensure it's set
    if (newState === 'completed' && additionalFields.video_url) {
      update.video_url = additionalFields.video_url;
      // Clear render tracking fields
      update.video_render_id = null;
      update.video_bucket_name = null;
    }

    // If transitioning to failed, ensure error is set
    if (newState === 'failed' && !additionalFields.processing_error) {
      update.processing_error = 'Video rendering failed';
    }

    // Atomic update with state validation in WHERE clause to prevent race conditions
    const { data: updated, error: updateError } = await supabase
      .from('patch_notes')
      .update(update)
      .eq('id', patchNoteId)
      .eq('processing_status', currentState) // Optimistic locking - only update if state hasn't changed
      .select('processing_status')
      .single();

    if (updateError || !updated) {
      // State was changed by another process (race condition detected)
      if (updateError?.code === 'PGRST116') {
        return {
          success: false,
          previousState: currentState,
          newState: null,
          error: 'State was modified by another process. Please retry.',
        };
      }

      return {
        success: false,
        previousState: currentState,
        newState: null,
        error: `Failed to update state: ${updateError?.message ?? 'Unknown error'}`,
      };
    }

    console.log(`✅ State transition: ${currentState} → ${newState} (${patchNoteId})`);

    // Map database state back to internal state
    const returnedState = updated.processing_status === 'generating_video' && newState === 'rendering'
      ? 'rendering' as VideoRenderState
      : updated.processing_status as VideoRenderState;

    return {
      success: true,
      previousState: currentState,
      newState: returnedState,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ State transition error:', errorMessage);
    
    return {
      success: false,
      previousState: null,
      newState: null,
      error: errorMessage,
    };
  }
}

/**
 * Get current video render state for a patch note
 * Cached in-memory for a short period to reduce database round-trips
 */
const stateCache = new Map<string, { state: VideoRenderState | string; timestamp: number }>();
const CACHE_TTL_MS = 1000; // 1 second cache

export async function getVideoRenderState(
  patchNoteId: string,
  bypassCache = false
): Promise<{
  state: VideoRenderState | string | null;
  renderId: string | null;
  bucketName: string | null;
  videoUrl: string | null;
  progress: number | null;
  error: string | null;
}> {
  // Check cache first (unless bypassed)
  if (!bypassCache) {
    const cached = stateCache.get(patchNoteId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return {
        state: cached.state,
        renderId: null,
        bucketName: null,
        videoUrl: null,
        progress: null,
        error: null,
      };
    }
  }

  const supabase = createServiceSupabaseClient();

  const { data, error } = await supabase
    .from('patch_notes')
    .select(
      'processing_status, video_render_id, video_bucket_name, video_url, processing_progress, processing_error'
    )
    .eq('id', patchNoteId)
    .single();

  if (error || !data) {
    return {
      state: null,
      renderId: null,
      bucketName: null,
      videoUrl: null,
      progress: null,
      error: error?.message ?? 'Not found',
    };
  }

  const state = data.processing_status as VideoRenderState | string | null;

  // Update cache
  if (state) {
    stateCache.set(patchNoteId, { state, timestamp: Date.now() });
  }

  return {
    state,
    renderId: data.video_render_id ?? null,
    bucketName: data.video_bucket_name ?? null,
    videoUrl: data.video_url ?? null,
    progress: data.processing_progress ?? null,
    error: data.processing_error ?? null,
  };
}

/**
 * Clear state cache for a patch note (use after state transitions)
 */
export function clearStateCache(patchNoteId: string): void {
  stateCache.delete(patchNoteId);
}

/**
 * Batch state update - update state along with progress
 * More efficient than separate calls
 */
export async function updateVideoRenderProgress(
  patchNoteId: string,
  progress: number,
  stage?: string
): Promise<boolean> {
  const supabase = createServiceSupabaseClient();

  const update: Record<string, unknown> = {
    processing_progress: Math.max(0, Math.min(100, progress)),
  };

  if (stage) {
    update.processing_stage = stage;
  }

  // Also ensure state is 'generating_video' if progress > 0
  // (we use 'rendering' semantically in responses, but DB stores 'generating_video')
  const currentState = await getVideoRenderState(patchNoteId);
  if (currentState.state !== 'generating_video' && progress > 0 && progress < 100) {
    const transitionResult = await transitionVideoRenderState(
      patchNoteId,
      'generating_video',
      update
    );
    return transitionResult.success;
  }

  const { error } = await supabase
    .from('patch_notes')
    .update(update)
    .eq('id', patchNoteId);

  if (error) {
    console.error('❌ Failed to update progress:', error);
    return false;
  }

  // Clear cache
  clearStateCache(patchNoteId);

  return true;
}
