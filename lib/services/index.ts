/**
 * Services Layer
 * Pure functional business logic, separated from HTTP concerns
 * 
 * This layer eliminates route-to-route HTTP calls and provides
 * testable, composable business logic.
 */

export {
  fetchGitHubStats,
  validateGitHubStatsInput,
  type FetchGitHubStatsInput,
} from './github-stats.service';

export {
  summarizeCommits,
  validateSummarizeInput,
  type SummarizeCommitsInput,
  type DetailedContext,
  type SummarizationResult,
} from './github-summarize.service';

export {
  processPatchNote,
  type ProcessPatchNoteInput,
  type ProcessingResult,
} from './patch-note-processor.service';

export {
  renderVideo,
  type RenderVideoInput,
  type RenderVideoResult,
} from './video-render.service';

export {
  transitionVideoRenderState,
  getVideoRenderState,
  updateVideoRenderProgress,
  clearStateCache,
  type StateTransitionResult,
  type StateUpdateFields,
} from './video-render-state-manager';

export {
  isValidTransition,
  getValidNextStates,
  isTerminalState,
  getStateMetadata,
  STATE_METADATA,
  type VideoRenderState,
  type StateMetadata,
} from './video-render-state-machine';

export type { ServiceResult } from './github-stats.service';

