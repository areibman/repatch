import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { TemplateExamples } from '@/types/ai-template';

export interface CommitSummary {
  sha: string;
  message: string;
  aiSummary: string;
  additions: number;
  deletions: number;
}

export interface SummaryTemplateConfig {
  name: string;
  audience: string;
  commitPrompt: string;
  overallPrompt: string;
  examples?: TemplateExamples;
}

const DEFAULT_COMMIT_PROMPT = `You are analyzing a Git commit to create a concise summary for a newsletter.

Summaries should be direct, actionable, and avoid filler like "This commit" or "significantly". Prefer plain English.`;

const DEFAULT_OVERALL_PROMPT = `You are writing a brief newsletter intro for the repository.

Keep the tone informative. Use one or two crisp sentences that highlight the main themes without fluff.`;

function buildCommitPrompt(
  commitMessage: string,
  diff: string,
  additions: number,
  deletions: number,
  template?: SummaryTemplateConfig
): string {
  const base = template?.commitPrompt?.trim() || DEFAULT_COMMIT_PROMPT;

  const exampleSection =
    template?.examples?.commitExamples?.length
      ? `\n\nExample summaries for inspiration:\n${template.examples.commitExamples
          .map((example, index) => `${index + 1}. ${example.title}: ${example.summary}`)
          .join('\n')}`
      : '';

  const fallbackGuard = `\n\nIf the guidance above does not specify tone or length, reply with one sentence under 40 words.`;

  return `${base}${exampleSection}${fallbackGuard}\n\nCommit Message:\n${commitMessage}\n\nCode Changes:\n- Lines added: ${additions}\n- Lines deleted: ${deletions}\n\nDiff Preview (first 2000 characters):\n${diff.substring(0, 2000)}\n\nSummary:`;
}

function buildOverallPrompt(
  repoName: string,
  timePeriod: '1day' | '1week' | '1month',
  summariesText: string,
  totalCommits: number,
  totalAdditions: number,
  totalDeletions: number,
  template?: SummaryTemplateConfig
): string {
  const base = template?.overallPrompt?.trim() || DEFAULT_OVERALL_PROMPT;

  const exampleSection = template?.examples?.overallExample
    ? `\n\nExample intro:\n${template.examples.overallExample}`
    : '';

  const fallbackGuard = `\n\nIf tone is unspecified, keep it neutral and under 45 words.`;

  const periodLabel = timePeriod === '1day' ? 'day' : timePeriod === '1week' ? 'week' : 'month';

  return `${base}${exampleSection}${fallbackGuard}\n\nRepository: ${repoName}\nTime Period: Past ${periodLabel}\nTotal Commits: ${totalCommits}\nLines Added: ${totalAdditions}\nLines Deleted: ${totalDeletions}\n\nKey Changes:\n${summariesText}\n\nIntroduction:`;
}

/**
 * Generate AI summary for a single commit with its diff
 */
export async function summarizeCommit(
  commitMessage: string,
  diff: string,
  additions: number,
  deletions: number,
  template?: SummaryTemplateConfig
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
  template?: SummaryTemplateConfig
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
  template?: SummaryTemplateConfig
): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return `This ${timePeriod} saw ${totalCommits} commits with ${totalAdditions} additions and ${totalDeletions} deletions.`;
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const summariesText = commitSummaries
      .map((s, i) => `${i + 1}. ${s.aiSummary}`)
      .join('\n');

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: buildOverallPrompt(
        repoName,
        timePeriod,
        summariesText,
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

