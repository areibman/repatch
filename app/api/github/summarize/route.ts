import { NextRequest, NextResponse } from 'next/server';
import { fetchGitHubCommits, fetchCommitStats, fetchCommitDiff } from '@/lib/github';
import { summarizeCommits, generatePatchNoteContent, SummarizerTemplate } from '@/lib/ai-summarizer';
import { createClient } from '@/lib/supabase/server';

async function loadTemplate(templateId?: string): Promise<SummarizerTemplate | undefined> {
  if (!templateId) {
    return undefined;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('ai_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !data) {
      console.warn('Unable to load template', error?.message);
      return undefined;
    }

    return {
      name: data.name,
      audience: data.audience as SummarizerTemplate['audience'],
      commitPrompt: data.commit_prompt,
      overallPrompt: data.overall_prompt,
      exampleInput: data.example_input,
      exampleOutput: data.example_output,
    };
  } catch (error) {
    console.warn('Failed to fetch template', error);
    return undefined;
  }
}

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

    const template = await loadTemplate(templateId);

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

    // Generate AI summaries
    const summaries = await summarizeCommits(commitsWithDiffs, template);

    // Calculate totals
    const totalAdditions = commitsWithStats.reduce((sum, c) => sum + c.additions, 0);
    const totalDeletions = commitsWithStats.reduce((sum, c) => sum + c.deletions, 0);

    const patchNoteContent = await generatePatchNoteContent({
      repoName: `${owner}/${repo}`,
      timePeriod,
      commitSummaries: summaries,
      totalCommits: commits.length,
      totalAdditions,
      totalDeletions,
      template,
    });

    const overallSummary = patchNoteContent.split('\n\n')[0]?.trim() || patchNoteContent;

    return NextResponse.json({
      summaries,
      overallSummary,
      patchNoteContent,
      totalCommits: commits.length,
      totalAdditions,
      totalDeletions,
      templateId: templateId ?? null,
    });
  } catch (error) {
    console.error('Error generating summaries:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summaries' },
      { status: 500 }
    );
  }
}

