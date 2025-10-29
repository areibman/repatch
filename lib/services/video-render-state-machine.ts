/**
 * Video Render State Machine
 * Centralized definition of video rendering states and transitions
 * 
 * This provides a single source of truth for:
 * - Valid states
 * - Valid transitions
 * - State transition rules
 * - Race condition prevention
 */

/**
 * Video render state enumeration
 * Defines all possible states in the video rendering lifecycle
 */
export type VideoRenderState =
  | 'idle'              // Initial state, no render job
  | 'queued'            // Render job queued but not started
  | 'rendering'         // Render job active on Lambda
  | 'completed'         // Render completed successfully
  | 'failed';           // Render failed or was cancelled

/**
 * Video render event enumeration
 * Defines all events that can trigger state transitions
 */
export type VideoRenderEvent =
  | 'start'             // Start a new render job
  | 'progress'          // Render progress update
  | 'complete'          // Render completed successfully
  | 'fail'              // Render failed
  | 'cancel';           // Cancel render

/**
 * State transition map
 * Defines valid transitions: currentState -> event -> newState
 */
const STATE_TRANSITIONS: Readonly<
  Record<VideoRenderState, Readonly<Partial<Record<VideoRenderEvent, VideoRenderState>>>>
> = {
  idle: {
    start: 'queued',
  },
  queued: {
    progress: 'rendering',
    fail: 'failed',
    cancel: 'failed',
  },
  rendering: {
    progress: 'rendering', // Self-transition allowed for progress updates
    complete: 'completed',
    fail: 'failed',
    cancel: 'failed',
  },
  completed: {
    // Terminal state - no transitions allowed
  },
  failed: {
    start: 'queued', // Allow retry from failed state
  },
} as const;

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  currentState: VideoRenderState,
  event: VideoRenderEvent
): boolean {
  const allowedTransitions = STATE_TRANSITIONS[currentState];
  return allowedTransitions?.[event] !== undefined;
}

/**
 * Get the next state for a given transition
 * Returns null if transition is invalid
 */
export function getNextState(
  currentState: VideoRenderState,
  event: VideoRenderEvent
): VideoRenderState | null {
  if (!isValidTransition(currentState, event)) {
    return null;
  }
  return STATE_TRANSITIONS[currentState][event] as VideoRenderState;
}

/**
 * Check if a state is terminal (no further transitions possible)
 */
export function isTerminalState(state: VideoRenderState): boolean {
  return state === 'completed' || state === 'failed';
}

/**
 * Check if a state is active (render in progress)
 */
export function isActiveState(state: VideoRenderState): boolean {
  return state === 'queued' || state === 'rendering';
}

/**
 * Map database processing_status to VideoRenderState
 */
export function mapProcessingStatusToState(
  processingStatus: string | null | undefined,
  hasRenderId: boolean
): VideoRenderState {
  if (!processingStatus) {
    return 'idle';
  }

  switch (processingStatus) {
    case 'generating_video':
      return hasRenderId ? 'rendering' : 'queued';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'idle';
  }
}

/**
 * Map VideoRenderState to database processing_status
 */
export function mapStateToProcessingStatus(
  state: VideoRenderState
): 'generating_video' | 'completed' | 'failed' {
  switch (state) {
    case 'queued':
    case 'rendering':
      return 'generating_video';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'idle':
      // Default to completed for idle state
      return 'completed';
  }
}
