import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export interface SummarizerTemplate {
  name?: string;
  audience?: 'technical' | 'non-technical' | 'balanced';
  commitPrompt?: string | null;
  overallPrompt?: string | null;
  exampleInput?: string | null;
  exampleOutput?: string | null;
}

const defaultCommitPrompt = `Write a single sentence (10-15 words) that clearly states what changed and why it matters. Use direct, jargon-light language and avoid filler phrases like "This commit" or "This update".`;

const defaultOverallPrompt = `Create Markdown patch notes for the provided repository and time period. Include:
- A short introductory paragraph for a balanced (technical & non-technical) audience.
- A "## Key Changes" section with one subsection per commit. Use concise headings derived from commit messages and summarize the impact in 2 sentences max.
- A "## Stats" section containing bullet points for total commits, additions, and deletions.
Keep the tone clear and confident. Avoid marketing fluff.`;

export function resolveTemplate(template?: SummarizerTemplate) {
  return {
    commitPrompt: template?.commitPrompt?.trim() || defaultCommitPrompt,
    overallPrompt: template?.overallPrompt?.trim() || defaultOverallPrompt,
    exampleInput: template?.exampleInput?.trim() || null,
    exampleOutput: template?.exampleOutput?.trim() || null,
  };
}

function prependExample(prompt: string, exampleInput: string | null, exampleOutput: string | null) {
  if (!exampleInput || !exampleOutput) {
    return prompt;
  }

  return `Example Input:\n${exampleInput}\n\nExample Output:\n${exampleOutput}\n\n${prompt}`;
}

export interface CommitSummary {
  sha: string;
  message: string;
  aiSummary: string;
  additions: number;
  deletions: number;
}

/**
 * Generate AI summary for a single commit with its diff
 */
export async function summarizeCommit(
  commitMessage: string,
  diff: string,
  additions: number,
  deletions: number,
  template?: SummarizerTemplate
): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('No Google API key found, skipping AI summarization');
      return commitMessage.split('\n')[0]; // Return first line of commit message
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const prompts = resolveTemplate(template);

    const context = `Commit Message:\n${commitMessage}\n\nLines Added: ${additions}\nLines Deleted: ${deletions}\n\nDiff Preview (first 2000 characters):\n${diff.substring(0, 2000)}`;

    const prompt = `${prompts.commitPrompt}\n\n${context}\n\nRespond with a single sentence.`;

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
  template?: SummarizerTemplate
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

interface PatchNoteContentParams {
  repoName: string;
  timePeriod: '1day' | '1week' | '1month';
  commitSummaries: CommitSummary[];
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  template?: SummarizerTemplate;
}

function getPeriodLabel(timePeriod: '1day' | '1week' | '1month') {
  switch (timePeriod) {
    case '1day':
      return 'day';
    case '1week':
      return 'week';
    case '1month':
      return 'month';
    default:
      return timePeriod;
  }
}

export async function generatePatchNoteContent({
  repoName,
  timePeriod,
  commitSummaries,
  totalCommits,
  totalAdditions,
  totalDeletions,
  template,
}: PatchNoteContentParams): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const periodLabel = getPeriodLabel(timePeriod);
      const summaryLines = commitSummaries
        .map((summary, index) => `${index + 1}. ${summary.aiSummary}`)
        .join('\n');

      return `### ${repoName} – ${periodLabel} in review\n\n${summaryLines}`;
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const prompts = resolveTemplate(template);
    const periodLabel = getPeriodLabel(timePeriod);
    const summariesText = commitSummaries
      .map((s, i) => `${i + 1}. Commit: ${s.message.split('\n')[0]}\nSummary: ${s.aiSummary}`)
      .join('\n\n');

    const basePrompt = `${prompts.overallPrompt}

Repository: ${repoName}
Time Period: Past ${periodLabel}
Total Commits: ${totalCommits}
Total Additions: ${totalAdditions}
Total Deletions: ${totalDeletions}

Commit Summaries:
${summariesText}`;

    const promptWithExamples = prependExample(
      basePrompt,
      prompts.exampleInput,
      prompts.exampleOutput
    );

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: promptWithExamples,
    });

    return text.trim();
  } catch (error) {
    console.error('Error generating patch note content:', error);
    const fallbackPeriod = getPeriodLabel(timePeriod);
    const lines = commitSummaries
      .map((summary) => `- ${summary.aiSummary}`)
      .join('\n');
    return `## ${repoName} update (${fallbackPeriod})\n\n${lines}`;
  }
}

