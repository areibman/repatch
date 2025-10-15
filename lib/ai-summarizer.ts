import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { TemplateExample } from '@/types/ai-template';

export interface CommitSummary {
  sha: string;
  message: string;
  aiSummary: string;
  additions: number;
  deletions: number;
}

export interface TemplateConfig {
  name?: string;
  commitPrompt: string;
  overallPrompt: string;
  examples?: TemplateExample[];
}

const DEFAULT_TEMPLATE: TemplateConfig = {
  name: 'Default Technical Digest',
  commitPrompt: `You are analyzing a Git commit to create a concise summary for a changelog.
{{examples}}

Commit Message:
{{commit_message}}

Code Changes:
- Lines added: {{additions}}
- Lines deleted: {{deletions}}

Diff Preview (first 2000 characters):
{{diff}}

Task: Write ONE short sentence (10-15 words max) describing what changed. Use plain, direct language like:
- "Doubled page loading speed"
- "Added dark mode toggle"
- "Fixed login error on mobile"

Do NOT use phrases like "This commit", "This update", "significantly", "streamlines", etc.
Just state what changed directly and simply.`,
  overallPrompt: `You are writing a brief newsletter intro for repository "{{repo_name}}".
{{examples}}

Time Period: {{time_period}}
Total Commits: {{total_commits}}

Key Changes:
{{commit_summaries}}

Task: Write 1-2 SHORT sentences (max 25 words total) summarizing what happened. Use plain, direct language and avoid filler phrases.
Introduction:`,
  examples: [
    {
      title: 'Improve build pipeline',
      input:
        'Commit message "Optimize CI pipeline" with diff adding parallel matrix and caching config',
      output: 'Parallelized CI matrix and cached dependencies to shrink build times',
    },
  ],
};

function formatExamples(examples?: TemplateExample[]) {
  if (!examples || examples.length === 0) {
    return '';
  }

  return [
    'Examples:',
    ...examples.map((example, index) => {
      return [
        `${index + 1}. ${example.title ?? 'Example'}`,
        `Input:\n${example.input}`,
        `Output:\n${example.output}`,
      ].join('\n');
    }),
  ].join('\n\n');
}

function applyTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const trimmedKey = key.trim();
    return values[trimmedKey] ?? '';
  });
}

/**
 * Generate AI summary for a single commit with its diff
 */
export async function summarizeCommit(
  commitMessage: string,
  diff: string,
  additions: number,
  deletions: number,
  template: TemplateConfig = DEFAULT_TEMPLATE
): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('No Google API key found, skipping AI summarization');
      return commitMessage.split('\n')[0]; // Return first line of commit message
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const prompt = applyTemplate(template.commitPrompt, {
      commit_message: commitMessage,
      diff: diff.substring(0, 2000),
      additions: additions.toString(),
      deletions: deletions.toString(),
      examples: formatExamples(template.examples),
    });

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
  template: TemplateConfig = DEFAULT_TEMPLATE
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
  template: TemplateConfig = DEFAULT_TEMPLATE
): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return `This ${timePeriod} saw ${totalCommits} commits with ${totalAdditions} additions and ${totalDeletions} deletions.`;
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const periodLabel = timePeriod === '1day' ? 'day' : timePeriod === '1week' ? 'week' : 'month';

    const summariesText = commitSummaries
      .map((s, i) => `${i + 1}. ${s.aiSummary}`)
      .join('\n');

    const prompt = applyTemplate(template.overallPrompt, {
      repo_name: repoName,
      time_period: `past ${periodLabel}`,
      total_commits: totalCommits.toString(),
      total_additions: totalAdditions.toString(),
      total_deletions: totalDeletions.toString(),
      commit_summaries: summariesText,
      examples: formatExamples(template.examples),
    });

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
    });

    return text.trim();
  } catch (error) {
    console.error('Error generating overall summary:', error);
    return `This ${timePeriod} saw ${totalCommits} commits with ${totalAdditions} additions and ${totalDeletions} deletions.`;
  }
}

export function resolveTemplateConfig(
  template?: Partial<TemplateConfig> | null
): TemplateConfig {
  if (!template) {
    return DEFAULT_TEMPLATE;
  }

  return {
    commitPrompt: template.commitPrompt ?? DEFAULT_TEMPLATE.commitPrompt,
    overallPrompt: template.overallPrompt ?? DEFAULT_TEMPLATE.overallPrompt,
    examples:
      template.examples && template.examples.length > 0
        ? template.examples
        : DEFAULT_TEMPLATE.examples,
    name: template.name ?? DEFAULT_TEMPLATE.name,
  };
}

