import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

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
  deletions: number
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
      prompt: `You are analyzing a Git commit to create a concise summary for a newsletter.

Commit Message:
${commitMessage}

Code Changes:
- Lines added: ${additions}
- Lines deleted: ${deletions}

Diff Preview (first 2000 characters):
${diff.substring(0, 2000)}

Task: Write ONE short sentence (10-15 words max) describing what changed. Use plain, direct language like:
- "Doubled page loading speed"
- "Added dark mode toggle"
- "Fixed login error on mobile"

Do NOT use phrases like "This commit", "This update", "significantly", "streamlines", etc.
Just state what changed directly and simply.

Summary:`,
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
  }>
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
      commit.deletions
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
  totalDeletions: number
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

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: `You are writing a brief newsletter intro for repository "${repoName}".

Time Period: Past ${periodLabel}
Total Commits: ${totalCommits}

Key Changes:
${summariesText}

Task: Write 1-2 SHORT sentences (max 25 words total) summarizing what happened. Use plain, direct language:
- "Focused on performance and bug fixes"
- "Added new features and improved UI"
- "Major refactoring and dependency updates"

Do NOT use phrases like "This period saw", "significantly", "substantial", etc.
Just state what happened directly.

Introduction:`,
    });

    return text.trim();
  } catch (error) {
    console.error('Error generating overall summary:', error);
    return `This ${timePeriod} saw ${totalCommits} commits with ${totalAdditions} additions and ${totalDeletions} deletions.`;
  }
}

