import { NextRequest, NextResponse } from 'next/server';
import { getCommitsForFilters, fetchCommitStats, fetchCommitDiff, fetchPullRequestDetails } from '@/lib/github';
import {
  generateDetailedContext,
  generateFinalChangelog,
  type SummaryTemplate,
} from '@/lib/ai-summarizer';
import { createClient } from '@/lib/supabase/server';
import { mapTemplateRow } from '@/lib/templates';
import { FilterValidationError } from '@/lib/filter-utils';
import type { PatchNoteFilters } from '@/types/patch-note';

type TemplateOverridePayload = {
  content: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      owner?: string;
      repo?: string;
      filters?: PatchNoteFilters;
      branch?: string;
      templateId?: string;
      templateOverride?: TemplateOverridePayload;
      generateCommitTitles?: boolean;
    };
    const { owner, repo, filters, branch, templateId, templateOverride, generateCommitTitles } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    if (!filters) {
      return NextResponse.json(
        { error: 'Missing filters parameter' },
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
      console.log(`[Template] Loaded template: ${template.name} (${template.id})`);
      console.log(`[Template] Content length: ${template.content.length} chars`);
    } else if (
      templateOverride &&
      typeof templateOverride.content === 'string'
    ) {
      template = {
        content: templateOverride.content,
      };
    }

    // Fetch commits
    const commits = await getCommitsForFilters(
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

    // Fetch stats and diffs for ALL commits
    const commitsWithStats = await Promise.all(
      commits.map(async (commit) => {
        const stats = await fetchCommitStats(owner, repo, commit.sha);
        
        // Extract PR number from commit message if present
        const prMatch = commit.commit.message.match(/#(\d+)/);
        const prNumber = prMatch ? parseInt(prMatch[1], 10) : undefined;
        
        // Get author info
        const authorName = commit.author?.login || commit.commit.author.name;
        
        return {
          sha: commit.sha,
          message: commit.commit.message,
          additions: stats.additions,
          deletions: stats.deletions,
          authors: [authorName],
          prNumber,
        };
      })
    );

    // Sort ALL commits by significance (no limits!)
    const significantCommits = commitsWithStats
      .sort((a, b) => (b.additions + b.deletions) - (a.additions + a.deletions));

    // STEP 1: Generate detailed internal contexts for each commit
    console.log('[Step 1] Generating detailed contexts for each commit...');
    const detailedContexts = await Promise.all(
      significantCommits.map(async (commit) => {
        const diff = await fetchCommitDiff(owner, repo, commit.sha);
        
        // Fetch PR details if we have a PR number
        let prDetails = null;
        if (commit.prNumber) {
          console.log(`[Step 1] Fetching PR details for #${commit.prNumber}...`);
          prDetails = await fetchPullRequestDetails(owner, repo, commit.prNumber);
        }
        
        const detailedContext = await generateDetailedContext(
          commit.message,
          diff,
          commit.additions,
          commit.deletions,
          commit.authors,
          owner,
          repo,
          commit.prNumber,
          prDetails
        );
        
        return {
          context: detailedContext,
          message: commit.message,
          additions: commit.additions,
          deletions: commit.deletions,
          authors: commit.authors,
          prNumber: commit.prNumber,
        };
      })
    );

    // Calculate totals
    const totalAdditions = commitsWithStats.reduce((sum, c) => sum + c.additions, 0);
    const totalDeletions = commitsWithStats.reduce((sum, c) => sum + c.deletions, 0);

    // STEP 2: Apply template to generate final changelog
    console.log('[Step 2] Applying template to generate final changelog...');
    const finalChangelog = await generateFinalChangelog(
      owner,
      repo,
      filters,
      detailedContexts,
      template
    );

    return NextResponse.json({
      content: finalChangelog,
      detailedContexts, // Include for debugging/reference
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

