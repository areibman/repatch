import { NextRequest, NextResponse } from 'next/server';
import {
  collectCommits,
  fetchCommitStats,
  fetchCommitDiff,
  HistoryFilters,
  describeFilterSelection,
} from '@/lib/github';
import { summarizeCommits, generateOverallSummary } from '@/lib/ai-summarizer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, branch, filters: rawFilters, timePeriod } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const filters: HistoryFilters = rawFilters || {};

    if (!rawFilters && timePeriod) {
      filters.preset = timePeriod;
    }

    if (!filters.preset && !filters.customRange && !filters.releaseRange) {
      filters.preset = '1week';
    }

    const commits = await collectCommits(owner, repo, filters, branch);

    if (commits.length === 0) {
      return NextResponse.json({
        summaries: [],
        overallSummary: 'No commits found for the selected filters.',
        totalCommits: 0,
        totalAdditions: 0,
        totalDeletions: 0,
      });
    }

    // Fetch stats and diffs for significant commits (top 10 by size)
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

    // Get the top 10 most significant commits
    const significantCommits = commitsWithStats
      .sort((a, b) => (b.additions + b.deletions) - (a.additions + a.deletions))
      .slice(0, 10);

    // Fetch diffs for these commits
    const commitsWithDiffs = await Promise.all(
      significantCommits.map(async (commit) => ({
        ...commit,
        diff: await fetchCommitDiff(owner, repo, commit.sha),
      }))
    );

    // Generate AI summaries
    const summaries = await summarizeCommits(commitsWithDiffs);

    // Calculate totals
    const totalAdditions = commitsWithStats.reduce((sum, c) => sum + c.additions, 0);
    const totalDeletions = commitsWithStats.reduce((sum, c) => sum + c.deletions, 0);

    // Generate overall summary
    const overallSummary = await generateOverallSummary(
      `${owner}/${repo}`,
      describeFilterSelection(filters),
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
    });
  } catch (error) {
    console.error('Error generating summaries:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summaries' },
      { status: 500 }
    );
  }
}

