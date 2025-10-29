/**
 * Video Rendering State Machine
 * Centralized state machine for video rendering lifecycle
 * Ensures atomic transitions and prevents race conditions
 */

/**
 * Video render states
 */
export type VideoRenderState =
  | 'idle'                    // No render job initiated
  | 'initiating'              // Render job is being started
  | 'rendering'               // Render is in progress
  | 'completed'               // Render completed successfully
  | 'failed';                 // Render failed

/**
 * Valid state transitions
 * Maps from current state to array of valid next states
 */
const VALID_TRANSITIONS: Record<VideoRenderState, readonly VideoRenderState[]> = {
  idle: ['initiating', 'completed'],      // Can start a render or skip to completed (already rendered)
  initiating: ['rendering', 'failed'],    // Can transition to rendering or fail immediately
  rendering: ['completed', 'failed'],     // Can complete or fail
  completed: ['idle', 'initiating'],       // Can reset to idle (for regeneration) or restart
  failed: ['idle', 'initiating'],          // Can reset to idle or retry immediately
} as const;

/**
 * Processing status mapping
 * Maps video render states to database processing_status values
 */
const STATE_TO_PROCESSING_STATUS: Record<VideoRenderState, string> = {
  idle: 'completed',           // No video render needed
  initiating: 'generating_video',
  rendering: 'generating_video',
  completed: 'completed',
  failed: 'failed',
} as const;

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  from: VideoRenderState,
  to: VideoRenderState
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Get the database processing_status for a video render state
 */
export function getProcessingStatus(state: VideoRenderState): string {
  return STATE_TO_PROCESSING_STATUS[state];
}

/**
 * Determine video render state from database fields
 */
export function inferStateFromDatabase(
  processingStatus: string | null,
  videoUrl: string | null,
  videoRenderId: string | null,
  processingError: string | null
): VideoRenderState {
  // If video exists, it's completed
  if (videoUrl) {
    return 'completed';
  }

  // If there's an error and status is failed, it's failed
  if (processingError && processingStatus === 'failed') {
    return 'failed';
  }

  // If render ID exists but no video URL, it's rendering
  if (videoRenderId && processingStatus === 'generating_video') {
    return 'rendering';
  }

  // If status is generating_video but no render ID, it's initiating
  if (processingStatus === 'generating_video' && !videoRenderId) {
    return 'initiating';
  }

  // Default to idle (no render job)
  return 'idle';
}

/**
 * State transition error
 */
export class InvalidStateTransitionError extends Error {
  constructor(
    public readonly from: VideoRenderState,
    public readonly to: VideoRenderState
  ) {
    super(
      `Invalid state transition: ${from} -> ${to}. Valid transitions from ${from}: ${VALID_TRANSITIONS[from].join(', ')}`
    );
    this.name = 'InvalidStateTransitionError';
  }
}
