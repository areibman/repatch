/**
 * Patch Note Processor Service
 * Orchestrates the entire patch note generation pipeline
 * Pure, functional approach with no mutations
 */

import { createServerSupabaseClient } from '@/lib/supabase';
import { generateBoilerplateContent } from '@/lib/github';
import { generateVideoTopChangesFromContent } from '@/lib/ai-summarizer';
import { fetchGitHubStats, type FetchGitHubStatsInput } from './github-stats.service';
import {
  summarizeCommits,
  type SummarizeCommitsInput,
  type SummarizationResult,
} from './github-summarize.service';
import type { ServiceResult } from './github-stats.service';
import type { PatchNoteFilters } from '@/types/patch-note';
import { transitionVideoRenderState } from './video-render-state-manager';

/**
 * Input for processing a patch note
 */
export interface ProcessPatchNoteInput {
  readonly patchNoteId: string;
  readonly owner: string;
  readonly repo: string;
  readonly repoUrl: string;
  readonly branch?: string;
  readonly filters: PatchNoteFilters;
  readonly templateId?: string;
  readonly cookieStore: {
    getAll(): Array<{ name: string; value: string }>;
    set(name: string, value: string, options?: Record<string, unknown>): void;
  };
}

/**
 * Processing stage for status updates
 */
type ProcessingStage =
  | 'fetching_stats'
  | 'analyzing_commits'
  | 'generating_content'
  | 'generating_video'
  | 'completed'
  | 'failed';

/**
 * Video data structure
 */
interface VideoData {
  readonly langCode: string;
  readonly topChanges: ReadonlyArray<{
    readonly title: string;
    readonly description: string;
  }>;
  readonly allChanges: ReadonlyArray<string>;
}

/**
 * Result of patch note processing
 */
export interface ProcessingResult {
  readonly hasVideoData: boolean;
}

/**
 * Update patch note status in database
 * Uses centralized state manager for video-related states
 */
async function updatePatchNoteStatus(
  patchNoteId: string,
  stage: ProcessingStage,
  message: string,
  cookieStore: ProcessPatchNoteInput['cookieStore']
): Promise<void> {
  // Use centralized state manager for video-related states
  if (stage === 'generating_video' || stage === 'failed' || stage === 'completed') {
    const transitionResult = await transitionVideoRenderState(
      patchNoteId,
      stage as 'generating_video' | 'failed' | 'completed',
      {
        processing_stage: message,
        ...(stage !== 'failed' && { processing_error: null }),
      }
    );

    if (!transitionResult.success) {
      throw new Error(`State transition failed: ${transitionResult.error}`);
    }
    return;
  }

  // For non-video states, use direct database update
  const supabase = createServerSupabaseClient(cookieStore);
  const { error } = await supabase
    .from('patch_notes')
    .update({
      processing_status: stage,
      processing_stage: message,
      ...(stage !== 'failed' && { processing_error: null }),
    })
    .eq('id', patchNoteId);

  if (error) {
    throw new Error(`Database update failed: ${error.message}`);
  }
}

/**
 * Generate video data from content
 */
async function generateVideoData(
  content: string,
  repoName: string
): Promise<VideoData | null> {
  try {
    console.log('🎬 Generating video top 3 from final content...');
    
    const videoTopChanges = await generateVideoTopChangesFromContent(content, repoName);
    
    if (!videoTopChanges || videoTopChanges.length === 0) {
      console.warn('⚠️ No video top changes generated');
      return null;
    }

    console.log('✅ Generated', videoTopChanges.length, 'video top changes');

    return {
      langCode: 'en',
      topChanges: videoTopChanges,
      allChanges: [],
    };
  } catch (error) {
    console.error('⚠️ Failed to generate video top changes:', error);
    return null;
  }
}


/**
 * Main processing pipeline
 * Pure functional composition
 */
export async function processPatchNote(
  input: ProcessPatchNoteInput
): Promise<ServiceResult<ProcessingResult>> {
  try {
    console.log('🚀 Starting async processing for patch note:', input.patchNoteId);
    console.log('   - Owner/Repo:', `${input.owner}/${input.repo}`);
    console.log('   - Branch:', input.branch);

    // Stage 1: Fetch Stats
    await updatePatchNoteStatus(
      input.patchNoteId,
      'fetching_stats',
      'Fetching repository statistics...',
      input.cookieStore
    );

    const statsInput: FetchGitHubStatsInput = {
      owner: input.owner,
      repo: input.repo,
      branch: input.branch,
      filters: input.filters,
    };

    const statsResult = await fetchGitHubStats(statsInput);
    if (!statsResult.success) {
      throw new Error(statsResult.error);
    }
    const stats = statsResult.data;

    // Stage 2: Analyze Commits
    await updatePatchNoteStatus(
      input.patchNoteId,
      'analyzing_commits',
      'Analyzing commits with AI (30-60s)...',
      input.cookieStore
    );

    const summarizeInput: SummarizeCommitsInput = {
      owner: input.owner,
      repo: input.repo,
      filters: input.filters,
      branch: input.branch,
      templateId: input.templateId,
      cookieStore: input.cookieStore,
    };

    const summaryResult = await summarizeCommits(summarizeInput);
    
    // Use AI content if available, otherwise generate boilerplate
    const content = summaryResult.success
      ? summaryResult.data.content
      : generateBoilerplateContent(`${input.owner}/${input.repo}`, input.filters, stats);

    const detailedContexts = summaryResult.success ? summaryResult.data.detailedContexts : [];

    if (summaryResult.success) {
      console.log('✅ AI changelog generated from', detailedContexts.length, 'commits');
    } else {
      console.warn('⚠️ Failed to generate AI changelog, using boilerplate');
    }

    // Stage 3: Generate Content
    await updatePatchNoteStatus(
      input.patchNoteId,
      'generating_content',
      'Generating patch note content...',
      input.cookieStore
    );

    // Stage 4: Generate Video Data (if content is available)
    const videoData = await generateVideoData(content, `${input.owner}/${input.repo}`);
    const videoTopChanges = videoData?.topChanges ?? null;

    // Final Update - update database with content and stats
    const supabase = createServerSupabaseClient(input.cookieStore);
    const finalUpdate = {
      content,
      changes: {
        added: stats.additions,
        modified: 0,
        removed: stats.deletions,
      },
      contributors: stats.contributors,
      ai_detailed_contexts: detailedContexts,
      video_data: videoData,
      video_top_changes: videoTopChanges,
    };

    const { error: updateError } = await supabase
      .from('patch_notes')
      .update(finalUpdate)
      .eq('id', input.patchNoteId);

    if (updateError) {
      throw new Error(`Failed to update patch note: ${updateError.message}`);
    }

    // Update status using centralized state manager
    if (videoData) {
      await updatePatchNoteStatus(
        input.patchNoteId,
        'generating_video',
        'Preparing video render...',
        input.cookieStore
      );
    } else {
      await updatePatchNoteStatus(
        input.patchNoteId,
        'completed',
        'Content generation complete',
        input.cookieStore
      );
    }

    console.log('✅ Content generation complete');
    if (videoData) {
      console.log('   - Video data ready with', videoData.topChanges.length, 'top changes');
      console.log('   - Frontend should call /render-video endpoint');
    }

    return {
      success: true,
      data: { hasVideoData: !!videoData },
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : 'Unknown error during processing';

    console.error('❌ Processing error:', errorMessage);

    // Update with error status
    try {
      await updatePatchNoteStatus(
        input.patchNoteId,
        'failed',
        errorMessage,
        input.cookieStore
      );
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    return { success: false, error: errorMessage };
  }
}

