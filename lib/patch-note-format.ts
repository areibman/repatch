import { CommitSummary } from "@/lib/ai-summarizer";

export type SummaryForFormatting = Pick<
  CommitSummary,
  "message" | "aiSummary" | "additions" | "deletions"
>;

export function formatPatchNoteContentFromSummaries(
  overallSummary: string | null,
  summaries: SummaryForFormatting[],
  fallback: string
): string {
  if (!overallSummary) {
    return fallback;
  }

  const body = summaries
    .map((summary) => {
      const heading = summary.message.split("\n")[0];
      return `### ${heading}\n${summary.aiSummary}\n\n**Changes:** +${summary.additions} -${summary.deletions} lines`;
    })
    .join("\n\n");

  return `${overallSummary}\n\n## Key Changes\n\n${body}`;
}
