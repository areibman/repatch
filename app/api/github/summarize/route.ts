import { NextRequest, NextResponse } from 'next/server';
import { fetchGitHubCommits, fetchCommitStats, fetchCommitDiff } from '@/lib/github';
import { summarizeCommits, generateOverallSummary, SummaryTemplateConfig } from '@/lib/ai-summarizer';
import { createClient } from '@/lib/supabase/server';
import { toAiTemplate } from '@/lib/ai-template';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, timePeriod, branch, templateId } = body;

    if (!owner || !repo || !timePeriod) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
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
      since.toISOString(),
      now.toISOString(),
      branch
    );

    if (commits.length === 0) {
      return NextResponse.json({
        summaries: [],
        overallSummary: 'No commits found in this time period.',
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

    let template: SummaryTemplateConfig | undefined;

    if (templateId) {
      try {
        const supabase = await createClient();
        const { data: templateRow } = await supabase
          .from('ai_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (templateRow) {
          const parsed = toAiTemplate(templateRow);
          template = {
            name: parsed.name,
            audience: parsed.audience,
            commitPrompt: parsed.commitPrompt,
            overallPrompt: parsed.overallPrompt,
            examples: parsed.examples,
          };
        }
      } catch (templateError) {
        console.warn('Failed to load AI template', templateError);
      }
    }

    // Generate AI summaries
    const summaries = await summarizeCommits(commitsWithDiffs, template);

    // Calculate totals
    const totalAdditions = commitsWithStats.reduce((sum, c) => sum + c.additions, 0);
    const totalDeletions = commitsWithStats.reduce((sum, c) => sum + c.deletions, 0);

    // Generate overall summary
    const overallSummary = await generateOverallSummary(
      `${owner}/${repo}`,
      timePeriod,
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summaries' },
      { status: 500 }
    );
  }
}

