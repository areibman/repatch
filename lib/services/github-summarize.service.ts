/**
 * GitHub Summarization Service
 * Pure functions for AI-powered commit summarization
 */

import {
  getCommitsForFilters,
  fetchCommitStats,
  fetchCommitDiff,
  fetchPullRequestDetails,
} from '@/lib/github';
import {
  generateDetailedContext,
  generateFinalChangelog,
  type SummaryTemplate,
} from '@/lib/ai-summarizer';
import { createServerSupabaseClient } from '@/lib/supabase';
import { mapTemplateRow } from '@/lib/templates';
import type { PatchNoteFilters } from '@/types/patch-note';
import type { ServiceResult } from './github-stats.service';

/**
 * Input parameters for summarization
 */
export interface SummarizeCommitsInput {
  readonly owner: string;
  readonly repo: string;
  readonly filters: PatchNoteFilters;
  readonly branch?: string;
  readonly templateId?: string;
  readonly cookieStore: {
    getAll(): Array<{ name: string; value: string }>;
    set(name: string, value: string, options?: Record<string, unknown>): void;
  };
}

/**
 * Detailed context for a single commit
 * Note: authors is not readonly to match generateFinalChangelog signature
 */
export interface DetailedContext {
  readonly context: string;
  readonly message: string;
  readonly additions: number;
  readonly deletions: number;
  readonly authors: string[];
  readonly prNumber?: number;
}

/**
 * Result of the summarization process
 */
export interface SummarizationResult {
  readonly content: string;
  readonly detailedContexts: readonly DetailedContext[];
  readonly totalCommits: number;
  readonly totalAdditions: number;
  readonly totalDeletions: number;
}

/**
 * Fetch template from database if templateId is provided
 */
async function fetchTemplate(
  templateId: string | undefined,
  cookieStore: SummarizeCommitsInput['cookieStore']
): Promise<ServiceResult<SummaryTemplate | undefined>> {
  if (!templateId) {
    return { success: true, data: undefined };
  }

  try {
    const supabase = createServerSupabaseClient(cookieStore);
    const { data, error } = await supabase
      .from('ai_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !data) {
      return { success: false, error: 'Template not found' };
    }

    const mapped = mapTemplateRow(data);
    if (!mapped.content) {
      return { success: false, error: 'Template has no content' };
    }

    return {
      success: true,
      data: {
        id: mapped.id,
        name: mapped.name,
        content: mapped.content,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch template';
    return { success: false, error: errorMessage };
  }
}

/**
 * Enrich commit with stats and diff
 */
async function enrichCommit(
  owner: string,
  repo: string,
  commit: { sha: string; commit: { message: string; author: { name: string } }; author: { login: string } | null }
): Promise<{
  readonly sha: string;
  readonly message: string;
  readonly additions: number;
  readonly deletions: number;
  readonly authors: string[];
  readonly prNumber?: number;
}> {
  const stats = await fetchCommitStats(owner, repo, commit.sha);
  const prMatch = commit.commit.message.match(/#(\d+)/);
  const prNumber = prMatch ? parseInt(prMatch[1], 10) : undefined;
  const authorName = commit.author?.login || commit.commit.author.name;

  return {
    sha: commit.sha,
    message: commit.commit.message,
    additions: stats.additions,
    deletions: stats.deletions,
    authors: [authorName],
    prNumber,
  };
}

/**
 * Generate detailed context for a single commit
 */
async function generateCommitContext(
  owner: string,
  repo: string,
  commit: Awaited<ReturnType<typeof enrichCommit>>
): Promise<DetailedContext> {
  const diff = await fetchCommitDiff(owner, repo, commit.sha);

  const prDetails = commit.prNumber
    ? await fetchPullRequestDetails(owner, repo, commit.prNumber)
    : null;

  const context = await generateDetailedContext(
    commit.message,
    diff,
    commit.additions,
    commit.deletions,
    [...commit.authors],
    owner,
    repo,
    commit.prNumber,
    prDetails
  );

  return {
    context,
    message: commit.message,
    additions: commit.additions,
    deletions: commit.deletions,
    authors: [...commit.authors], // Create mutable copy for external API compatibility
    prNumber: commit.prNumber,
  };
}

/**
 * Sort commits by significance (additions + deletions)
 */
function sortBySignificance<T extends { readonly additions: number; readonly deletions: number }>(
  commits: readonly T[]
): readonly T[] {
  return [...commits].sort((a, b) => 
    (b.additions + b.deletions) - (a.additions + a.deletions)
  );
}

/**
 * Calculate totals from commits
 */
function calculateTotals(
  commits: readonly { readonly additions: number; readonly deletions: number }[]
): { readonly totalAdditions: number; readonly totalDeletions: number } {
  return commits.reduce(
    (acc, commit) => ({
      totalAdditions: acc.totalAdditions + commit.additions,
      totalDeletions: acc.totalDeletions + commit.deletions,
    }),
    { totalAdditions: 0, totalDeletions: 0 }
  );
}

/**
 * Main summarization function
 * Pure, composable, no mutations
 */
export async function summarizeCommits(
  input: SummarizeCommitsInput
): Promise<ServiceResult<SummarizationResult>> {
  try {
    // Fetch template (if provided)
    const templateResult = await fetchTemplate(input.templateId, input.cookieStore);
    if (!templateResult.success) {
      return templateResult;
    }
    const template = templateResult.data;

    // Fetch commits
    const commits = await getCommitsForFilters(
      input.owner,
      input.repo,
      input.filters,
      input.branch
    );

    if (commits.length === 0) {
      return {
        success: true,
        data: {
          content: 'No commits found for the selected filters.',
          detailedContexts: [],
          totalCommits: 0,
          totalAdditions: 0,
          totalDeletions: 0,
        },
      };
    }

    // Enrich commits with stats (parallel)
    const enrichedCommits = await Promise.all(
      commits.map((commit) => enrichCommit(input.owner, input.repo, commit))
    );

    // Sort by significance
    const sortedCommits = sortBySignificance(enrichedCommits);

    // Generate detailed contexts (parallel)
    const detailedContexts = await Promise.all(
      sortedCommits.map((commit) =>
        generateCommitContext(input.owner, input.repo, commit)
      )
    );

    // Calculate totals
    const { totalAdditions, totalDeletions } = calculateTotals(enrichedCommits);

    // Generate final changelog
    const finalChangelog = await generateFinalChangelog(
      input.owner,
      input.repo,
      input.filters,
      detailedContexts,
      template
    );

    return {
      success: true,
      data: {
        content: finalChangelog,
        detailedContexts,
        totalCommits: commits.length,
        totalAdditions,
        totalDeletions,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : 'Failed to generate summaries';

    console.error('[GitHub Summarize Service] Error:', errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * Validate summarization input
 */
export function validateSummarizeInput(
  input: unknown,
  cookieStore: SummarizeCommitsInput['cookieStore']
): ServiceResult<SummarizeCommitsInput> {
  if (!input || typeof input !== 'object') {
    return { success: false, error: 'Invalid input: expected an object' };
  }

  const obj = input as Record<string, unknown>;

  if (!obj.owner || typeof obj.owner !== 'string') {
    return { success: false, error: 'Missing or invalid owner parameter' };
  }

  if (!obj.repo || typeof obj.repo !== 'string') {
    return { success: false, error: 'Missing or invalid repo parameter' };
  }

  if (!obj.filters) {
    return { success: false, error: 'Missing filters parameter' };
  }

  return {
    success: true,
    data: {
      owner: obj.owner,
      repo: obj.repo,
      filters: obj.filters as PatchNoteFilters,
      branch: typeof obj.branch === 'string' ? obj.branch : undefined,
      templateId: typeof obj.templateId === 'string' ? obj.templateId : undefined,
      cookieStore,
    },
  };
}

