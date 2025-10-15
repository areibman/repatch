import type { CommitSummary } from './ai-summarizer';
import { generateBoilerplateContent, type RepoStats } from './github';

interface BuildContentOptions {
  repoName: string;
  timePeriod: '1day' | '1week' | '1month';
  summaries: CommitSummary[];
  overallSummary?: string | null;
  stats?: RepoStats;
}

export function buildPatchNoteContent({
  repoName,
  timePeriod,
  summaries,
  overallSummary,
  stats,
}: BuildContentOptions) {
  if (overallSummary && summaries.length > 0) {
    const keyChanges = summaries
      .map((summary) => {
        const headline = summary.message.split('\n')[0];
        return `### ${headline}\n${summary.aiSummary}\n\n**Changes:** +${summary.additions} -${summary.deletions} lines`;
      })
      .join('\n\n');

    return `${overallSummary}\n\n## Key Changes\n\n${keyChanges}`;
  }

  if (stats) {
    return generateBoilerplateContent(repoName, timePeriod, stats);
  }

  return `# ${repoName} Update\n\nNo AI summary was generated for this period.`;
}
