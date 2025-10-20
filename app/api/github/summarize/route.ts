import { NextRequest, NextResponse } from 'next/server';
import { fetchGitHubCommits, fetchCommitStats, fetchCommitDiff } from '@/lib/github';
import {
  summarizeCommits,
  generateOverallSummary,
  type SummaryTemplate,
} from '@/lib/ai-summarizer';
import { createClient } from '@/lib/supabase/server';
import { mapTemplateRow } from '@/lib/templates';

type TemplateOverridePayload = {
  content: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      owner?: string;
      repo?: string;
      timePeriod?: '1day' | '1week' | '1month';
      branch?: string;
      templateId?: string;
      templateOverride?: TemplateOverridePayload;
    };
    const { owner, repo, timePeriod, branch, templateId, templateOverride } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    let template: SummaryTemplate | undefined;

    if (templateId) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('ai_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }

      const mapped = mapTemplateRow(data);
      template = {
        id: mapped.id,
        name: mapped.name,
        content: mapped.content,
      };
    } else if (
      templateOverride &&
      typeof templateOverride.content === 'string'
    ) {
      template = {
        content: templateOverride.content,
      };
    }

    // Calculate date range
    const now = new Date();
    const since = new Date(now);
    switch (timePeriod) {
      case '1day':
        since.setDate(since.getDate() - 1);
        break;
      case '1week':
        since.setDate(since.getDate() - 7);
        break;
      case '1month':
        since.setMonth(since.getMonth() - 1);
        break;
    }

    // Fetch commits
    const commits = await fetchGitHubCommits(
      owner,
      repo,
      filters,
      branch
    );

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
    const summaries = await summarizeCommits(commitsWithDiffs, template);

    // Calculate totals
    const totalAdditions = commitsWithStats.reduce((sum, c) => sum + c.additions, 0);
    const totalDeletions = commitsWithStats.reduce((sum, c) => sum + c.deletions, 0);

    // Generate overall summary
    const overallSummary = await generateOverallSummary(
      `${owner}/${repo}`,
      filters,
      summaries,
      commits.length,
      totalAdditions,
      totalDeletions,
      template
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
    if (error instanceof FilterValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summaries' },
      { status: 500 }
    );
  }
}

