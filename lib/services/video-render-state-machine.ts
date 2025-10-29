/**
 * Video Rendering State Machine
 * Centralized definition of all valid state transitions for video rendering
 * 
 * This prevents race conditions and ensures consistent state management
 * across all parts of the application.
 */

import type { ProcessingStatus } from '@/types/patch-note';

/**
 * Video rendering states
 * These map to the processing_status enum in the database
 */
export type VideoRenderState =
  | 'pending'
  | 'generating_video'
  | 'rendering'
  | 'completed'
  | 'failed';

/**
 * State transition validation
 * Returns true if transition from currentState to newState is valid
 */
export function isValidTransition(
  currentState: VideoRenderState | ProcessingStatus | null | undefined,
  newState: VideoRenderState
): boolean {
  // Handle null/undefined as 'pending'
  if (!currentState || currentState === 'pending') {
    return ['generating_video', 'failed'].includes(newState);
  }

  // Define valid state transitions
  const validTransitions: Record<VideoRenderState, VideoRenderState[]> = {
    pending: ['generating_video', 'failed'],
    generating_video: ['rendering', 'failed'],
    rendering: ['completed', 'failed'],
    completed: [], // Terminal state - no transitions allowed
    failed: ['generating_video'], // Allow retry from failed state
  };

  // Special case: allow transition to completed if video_url already exists
  if (newState === 'completed' && currentState !== 'failed') {
    return true;
  }

  const allowedTransitions = validTransitions[currentState as VideoRenderState];
  return allowedTransitions?.includes(newState) ?? false;
}

/**
 * Get the next valid states from a current state
 */
export function getValidNextStates(
  currentState: VideoRenderState | ProcessingStatus | null | undefined
): VideoRenderState[] {
  if (!currentState || currentState === 'pending') {
    return ['generating_video', 'failed'];
  }

  const validTransitions: Record<VideoRenderState, VideoRenderState[]> = {
    pending: ['generating_video', 'failed'],
    generating_video: ['rendering', 'failed'],
    rendering: ['completed', 'failed'],
    completed: [],
    failed: ['generating_video'],
  };

  return validTransitions[currentState as VideoRenderState] ?? [];
}

/**
 * Check if a state is terminal (no further transitions possible)
 */
export function isTerminalState(state: VideoRenderState | ProcessingStatus): boolean {
  return state === 'completed' || state === 'failed';
}

/**
 * State metadata for UI and logging
 */
export interface StateMetadata {
  readonly label: string;
  readonly description: string;
  readonly isError: boolean;
  readonly isComplete: boolean;
  readonly allowsProgressTracking: boolean;
}

export const STATE_METADATA: Record<VideoRenderState, StateMetadata> = {
  pending: {
    label: 'Pending',
    description: 'Video render not yet started',
    isError: false,
    isComplete: false,
    allowsProgressTracking: false,
  },
  generating_video: {
    label: 'Generating Video',
    description: 'Preparing video render job',
    isError: false,
    isComplete: false,
    allowsProgressTracking: false,
  },
  rendering: {
    label: 'Rendering',
    description: 'Video is being rendered',
    isError: false,
    isComplete: false,
    allowsProgressTracking: true,
  },
  completed: {
    label: 'Completed',
    description: 'Video render completed successfully',
    isError: false,
    isComplete: true,
    allowsProgressTracking: false,
  },
  failed: {
    label: 'Failed',
    description: 'Video render failed',
    isError: true,
    isComplete: true,
    allowsProgressTracking: false,
  },
};

/**
 * Get metadata for a state
 */
export function getStateMetadata(
  state: VideoRenderState | ProcessingStatus | null | undefined
): StateMetadata | null {
  if (!state) return null;
  
  // Map processing statuses to video render states
  const stateMap: Record<string, VideoRenderState> = {
    pending: 'pending',
    generating_video: 'generating_video',
    completed: 'completed',
    failed: 'failed',
  };

  const videoState = stateMap[state] ?? state as VideoRenderState;
  return STATE_METADATA[videoState] ?? null;
}
