import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export interface CommitSummary {
  sha: string;
  message: string;
  aiSummary: string;
  additions: number;
  deletions: number;
}

export interface SummaryTemplateExamples {
  sectionHeading?: string | null;
  overview?: string | null;
  commits?: Array<{
    title?: string | null;
    summary: string;
  }>;
}

export interface SummaryTemplate {
  id?: string;
  name?: string;
  commitPrompt: string;
  overallPrompt: string;
  examples?: SummaryTemplateExamples;
}

export const DEFAULT_TEMPLATE: SummaryTemplate = {
  name: 'Default Technical',
  commitPrompt:
    'You are analyzing a Git commit to create a concise summary for an engineering changelog. In one short sentence, describe the core change, the subsystem it touches, and any measurable impact.',
  overallPrompt:
    'You are writing the lead paragraph for a weekly engineering update. Summarize the dominant technical themes and quantify improvements when possible in 1-2 tight sentences.',
  examples: {
    sectionHeading: 'Key Changes',
    overview:
      'We focused the sprint on performance, reliability, and smoothing rough edges in the developer workflow.',
    commits: [
      {
        title: 'Improve cache stability',
        summary:
          'Hardened Redis eviction logic to prevent stale reads during deploys.',
      },
      {
        title: 'Accelerate CI feedback',
        summary:
          'Parallelized lint/test stages to drop pipeline duration by 40%.',
      },
    ],
  },
};

function resolveTemplate(template?: SummaryTemplate): SummaryTemplate {
  if (!template) {
    return DEFAULT_TEMPLATE;
  }

  return {
    ...DEFAULT_TEMPLATE,
    ...template,
    examples: {
      ...DEFAULT_TEMPLATE.examples,
      ...template.examples,
      commits:
        template.examples?.commits && template.examples.commits.length > 0
          ? template.examples.commits
          : DEFAULT_TEMPLATE.examples?.commits,
    },
  };
}

function buildCommitPrompt(
  commitMessage: string,
  diff: string,
  additions: number,
  deletions: number,
  template?: SummaryTemplate
): string {
  const resolved = resolveTemplate(template);
  const sections: string[] = [];

  sections.push(resolved.commitPrompt.trim());
  sections.push('');
  sections.push('Commit Message:');
  sections.push(commitMessage);
  sections.push('');
  sections.push('Change Metrics:');
  sections.push(`- Lines added: ${additions}`);
  sections.push(`- Lines deleted: ${deletions}`);

  const examples = resolved.examples?.commits ?? [];
  if (examples.length > 0) {
    sections.push('');
    sections.push('Follow the tone demonstrated in these examples:');
    sections.push(
      ...examples.map((example, index) => {
        const label = example.title ? `${example.title}: ` : '';
        return `${index + 1}. ${label}${example.summary}`;
      })
    );
  }

  sections.push('');
  sections.push('Diff Preview (first 2000 characters):');
  sections.push(diff.substring(0, 2000));
  sections.push('');
  sections.push('Summary:');

  return sections.join('\n');
}

function buildOverallPrompt(
  repoName: string,
  timePeriod: '1day' | '1week' | '1month',
  commitSummaries: CommitSummary[],
  totalCommits: number,
  totalAdditions: number,
  totalDeletions: number,
  template?: SummaryTemplate
): string {
  const resolved = resolveTemplate(template);
  const periodLabel =
    timePeriod === '1day' ? 'day' : timePeriod === '1week' ? 'week' : 'month';

  const sections: string[] = [];
  sections.push(resolved.overallPrompt.trim());
  sections.push('');
  sections.push(`Repository: ${repoName}`);
  sections.push(`Time Period: Past ${periodLabel}`);
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

  if (resolved.examples?.overview) {
    sections.push('');
    sections.push('Use a voice similar to this example overview:');
    sections.push(resolved.examples.overview);
  }

  sections.push('');
  sections.push('Introduction:');

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

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: buildCommitPrompt(
        commitMessage,
        diff,
        additions,
        deletions,
        template
      ),
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
  timePeriod: '1day' | '1week' | '1month',
  commitSummaries: CommitSummary[],
  totalCommits: number,
  totalAdditions: number,
  totalDeletions: number,
  template?: SummaryTemplate
): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return `This ${timePeriod} saw ${totalCommits} commits with ${totalAdditions} additions and ${totalDeletions} deletions.`;
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: buildOverallPrompt(
        repoName,
        timePeriod,
        commitSummaries,
        totalCommits,
        totalAdditions,
        totalDeletions,
        template
      ),
    });

    return text.trim();
  } catch (error) {
    console.error('Error generating overall summary:', error);
    return `This ${timePeriod} saw ${totalCommits} commits with ${totalAdditions} additions and ${totalDeletions} deletions.`;
  }
}

