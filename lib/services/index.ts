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
  getVideoRenderStatus,
  transitionVideoRenderState,
  startVideoRenderTransition,
  completeVideoRender,
  failVideoRender,
  markRenderStarted,
  type VideoRenderStatus,
  type StateTransitionResult,
} from './video-render-state.service';

export {
  type VideoRenderState,
  type VideoRenderEvent,
  isValidTransition,
  getNextState,
  isTerminalState,
  isActiveState,
  mapProcessingStatusToState,
  mapStateToProcessingStatus,
} from './video-render-state-machine';

export type { ServiceResult } from './github-stats.service';

