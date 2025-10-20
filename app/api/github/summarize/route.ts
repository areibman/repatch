import { NextRequest, NextResponse } from 'next/server';
import {
  fetchCommitDiff,
  fetchCommitStats,
  getCommitHistory,
} from '@/lib/github';
import { summarizeCommits, generateOverallSummary } from '@/lib/ai-summarizer';
import type { PatchNoteFilters } from '@/types/patch-note';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, branch, filters } = body as {
      owner?: string;
      repo?: string;
      branch?: string;
      filters?: PatchNoteFilters;
    };

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const history = await getCommitHistory(owner, repo, {
      branch,
      filters,
    });

    const commits = history.commits;

    if (commits.length === 0) {
      return NextResponse.json({
        summaries: [],
        overallSummary: 'No commits found for the selected filters.',
        totalCommits: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        contextLabel: history.contextLabel,
        timePeriod: history.timePeriod,
        releaseBaseTag: history.releaseBaseTag ?? null,
      });
    }

    const commitsWithStats = await Promise.all(
      commits.slice(0, 20).map(async (commit) => {
        const stats = await fetchCommitStats(owner, repo, commit.sha);
        return {
          sha: commit.sha,
          message: commit.commit.message,
          additions: stats.additions,
          deletions: stats.deletions,
        };
      })
    );

    const significantCommits = commitsWithStats
      .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))
      .slice(0, 10);

    const commitsWithDiffs = await Promise.all(
      significantCommits.map(async (commit) => ({
        ...commit,
        diff: await fetchCommitDiff(owner, repo, commit.sha),
      }))
    );

    const summaries = await summarizeCommits(commitsWithDiffs);

    const totalAdditions = commitsWithStats.reduce((sum, commit) => sum + commit.additions, 0);
    const totalDeletions = commitsWithStats.reduce((sum, commit) => sum + commit.deletions, 0);

    const overallSummary = await generateOverallSummary(
      `${owner}/${repo}`,
      history.contextLabel,
      summaries,
      commits.length,
      totalAdditions,
      totalDeletions
    );

    return NextResponse.json({
      summaries,
      overallSummary,
      totalCommits: commits.length,
      totalAdditions,
      totalDeletions,
      contextLabel: history.contextLabel,
      timePeriod: history.timePeriod,
      releaseBaseTag: history.releaseBaseTag ?? null,
    });
  } catch (error) {
    console.error('Error generating summaries:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summaries' },
      { status: 500 }
    );
  }
}
