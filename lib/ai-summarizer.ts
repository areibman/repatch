import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { PatchNoteFilters } from '@/types/patch-note';
import { formatFilterSummary, formatFilterDetailLabel } from './filter-utils';

export interface CommitSummary {
  sha: string;
  message: string;
  aiSummary: string;
  additions: number;
  deletions: number;
}

export interface SummaryTemplate {
  id?: string;
  name?: string;
  content: string;
}

export const DEFAULT_TEMPLATE: SummaryTemplate = {
  name: 'Default Technical',
  content: `# Default Technical Template

This template is designed for engineering-focused audiences who care about implementation details and measurable performance improvements.

## Commit Summary Instructions

For each commit, write one short sentence that describes:
- The core change
- The subsystem it touches
- Any measurable impact

### Example Commit Summaries:
- **Improve cache stability**: Hardened Redis eviction logic to prevent stale reads during deploys.
- **Accelerate CI feedback**: Parallelized lint/test stages to drop pipeline duration by 40%.

## Overall Summary Instructions

For the opening paragraph, write 1-2 tight sentences that:
- Summarize the dominant technical themes
- Quantify improvements when possible

### Example Opening:
We focused the sprint on performance, reliability, and smoothing rough edges in the developer workflow.
`,
};

function buildCommitPrompt(
  commitMessage: string,
  diff: string,
  additions: number,
  deletions: number,
  template?: SummaryTemplate
): string {
  const resolved = template || DEFAULT_TEMPLATE;
  const sections: string[] = [];

  sections.push('You are analyzing a Git commit to create a summary for a changelog.');
  sections.push('');
  sections.push('Follow these template guidelines:');
  sections.push('---');
  sections.push(resolved.content);
  sections.push('---');
  sections.push('');
  sections.push('Commit Message:');
  sections.push(commitMessage);
  sections.push('');
  sections.push('Change Metrics:');
  sections.push(`- Lines added: ${additions}`);
  sections.push(`- Lines deleted: ${deletions}`);
  sections.push('');
  sections.push('Diff Preview (first 2000 characters):');
  sections.push(diff.substring(0, 2000));
  sections.push('');
  sections.push('Generate a concise summary following the template guidelines:');

  return sections.join('\n');
}

function buildOverallPrompt(
  repoName: string,
  filters: PatchNoteFilters | undefined,
  commitSummaries: CommitSummary[],
  totalCommits: number,
  totalAdditions: number,
  totalDeletions: number,
  template?: SummaryTemplate
): string {
  const resolved = template || DEFAULT_TEMPLATE;
  const filterLabel = formatFilterDetailLabel(filters);

  const sections: string[] = [];
  sections.push('You are writing the opening paragraph for a changelog newsletter.');
  sections.push('');
  sections.push('Follow these template guidelines:');
  sections.push('---');
  sections.push(resolved.content);
  sections.push('---');
  sections.push('');
  sections.push(`Repository: ${repoName}`);
  sections.push(`Time Period: ${filterLabel}`);
  sections.push(`Total Commits: ${totalCommits}`);
  sections.push(`Lines Added: ${totalAdditions}`);
  sections.push(`Lines Deleted: ${totalDeletions}`);

  if (commitSummaries.length > 0) {
    sections.push('');
    sections.push('Key commit takeaways:');
    sections.push(
      ...commitSummaries.map(
        (summary, index) =>
          `${index + 1}. ${summary.aiSummary || summary.message.split('\n')[0]}`
      )
    );
  }

  sections.push('');
  sections.push('Generate an introduction following the template guidelines:');

  return sections.join('\n');
}

/**
 * Generate AI summary for a single commit with its diff
 */
export async function summarizeCommit(
  commitMessage: string,
  diff: string,
  additions: number,
  deletions: number,
  template?: SummaryTemplate
): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('No Google API key found, skipping AI summarization');
      return commitMessage.split('\n')[0]; // Return first line of commit message
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const prompt = buildCommitPrompt(
      commitMessage,
      diff,
      additions,
      deletions,
      template
    );
    
    console.log(`[AI Template] Using template: ${template?.name || 'DEFAULT'}`);
    console.log(`[AI Template] Prompt length: ${prompt.length} chars`);

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
    });

    return text.trim();
  } catch (error) {
    console.error('Error generating AI summary:', error);
    // Fallback to first line of commit message
    return commitMessage.split('\n')[0];
  }
}

/**
 * Generate AI summaries for multiple commits
 */
export async function summarizeCommits(
  commits: Array<{
    sha: string;
    message: string;
    diff?: string;
    additions: number;
    deletions: number;
  }>,
  template?: SummaryTemplate
): Promise<CommitSummary[]> {
  const summaries: CommitSummary[] = [];

  // Limit to top 10 most significant commits to avoid rate limits
  const significantCommits = commits
    .sort((a, b) => (b.additions + b.deletions) - (a.additions + a.deletions))
    .slice(0, 10);

  for (const commit of significantCommits) {
    const aiSummary = await summarizeCommit(
      commit.message,
      commit.diff || '',
      commit.additions,
      commit.deletions,
      template
    );

    summaries.push({
      sha: commit.sha,
      message: commit.message,
      aiSummary,
      additions: commit.additions,
      deletions: commit.deletions,
    });
  }

  return summaries;
}

/**
 * Generate an overall summary of all changes for the email
 */
export async function generateOverallSummary(
  repoName: string,
  filters: PatchNoteFilters | undefined,
  commitSummaries: CommitSummary[],
  totalCommits: number,
  totalAdditions: number,
  totalDeletions: number,
  template?: SummaryTemplate
): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const label = formatFilterSummary(
        filters,
        filters?.mode === 'release'
          ? 'release'
          : filters?.mode === 'custom'
          ? 'custom'
          : filters?.preset ?? '1week'
      );
      return `This ${label.toLowerCase()} window saw ${totalCommits} commits with ${totalAdditions} additions and ${totalDeletions} deletions.`;
    }

    const google = createGoogleGenerativeAI({ apiKey });
    
    const prompt = buildOverallPrompt(
      repoName,
      filters,
      commitSummaries,
      totalCommits,
      totalAdditions,
      totalDeletions,
      template
    );
    
    console.log(`[AI Template] Overall summary using template: ${template?.name || 'DEFAULT'}`);
    console.log(`[AI Template] Overall prompt length: ${prompt.length} chars`);
    
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
    });

    return text.trim();
  } catch (error) {
    console.error('Error generating overall summary:', error);
    const fallbackLabel = formatFilterSummary(
      filters,
      filters?.mode === 'release'
        ? 'release'
        : filters?.mode === 'custom'
        ? 'custom'
        : filters?.preset ?? '1week'
    );
    return `This ${fallbackLabel.toLowerCase()} window saw ${totalCommits} commits with ${totalAdditions} additions and ${totalDeletions} deletions.`;
  }
}
