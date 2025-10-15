import { Database, Json } from '@/lib/supabase/database.types';

type PatchNoteRow = Database['public']['Tables']['patch_notes']['Row'];

type CommitSummary = {
  sha: string;
  message: string;
  summary: string;
  additions?: number;
  deletions?: number;
};

export type SanitizedPatchNote = {
  id: string;
  title: string;
  repoName: string;
  repoUrl: string;
  generatedAt: string;
  timePeriod: PatchNoteRow['time_period'];
  summary: string | null;
  content: string;
  totals: PatchNoteRow['changes'];
  contributors: string[];
  highlights: CommitSummary[];
};

function isRecord(value: Json | undefined): value is Record<string, Json> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function coerceNumber(value: Json | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function coerceString(value: Json | undefined): string {
  return typeof value === 'string' ? value : '';
}

export function sanitizePatchNote(row: PatchNoteRow): SanitizedPatchNote {
  const summaries = Array.isArray(row.ai_summaries) ? row.ai_summaries : [];
  const highlights: CommitSummary[] = summaries
    .map((entry) => (isRecord(entry) ? entry : null))
    .filter((entry): entry is Record<string, Json> => entry !== null)
    .map((entry) => ({
      sha: coerceString(entry.sha),
      message: coerceString(entry.message),
      summary: coerceString(entry.aiSummary ?? entry.summary),
      additions: coerceNumber(entry.additions),
      deletions: coerceNumber(entry.deletions),
    }));

  return {
    id: row.id,
    title: row.title,
    repoName: row.repo_name,
    repoUrl: row.repo_url,
    generatedAt: row.generated_at,
    timePeriod: row.time_period,
    summary: row.ai_overall_summary,
    content: row.content,
    totals: row.changes,
    contributors: row.contributors,
    highlights,
  };
}
