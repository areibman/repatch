import { Database } from '@/lib/supabase/database.types';

export type SanitizedPatchNote = {
  id: string;
  repoName: string;
  repoUrl: string;
  title: string;
  timePeriod: Database['public']['Enums']['time_period_type'];
  generatedAt: string;
  summary: string | null;
  highlights: Array<{
    title: string;
    summary: string;
  }>;
  changeMetrics: {
    added: number;
    modified: number;
    removed: number;
  } | null;
};

type PatchNoteRow = Database['public']['Tables']['patch_notes']['Row'];

type AiSummary = {
  heading?: string;
  summary?: string;
};

export function sanitizePatchNote(row: PatchNoteRow): SanitizedPatchNote {
  const summaries = Array.isArray(row.ai_summaries)
    ? (row.ai_summaries as AiSummary[])
        .filter((item) => typeof item === 'object' && item !== null)
        .map((item) => ({
          title: String(item.heading ?? 'Update'),
          summary: String(item.summary ?? ''),
        }))
    : [];

  const metrics = row.changes && typeof row.changes === 'object'
    ? {
        added: Number((row.changes as any).added ?? 0),
        modified: Number((row.changes as any).modified ?? 0),
        removed: Number((row.changes as any).removed ?? 0),
      }
    : null;

  return {
    id: row.id,
    repoName: row.repo_name,
    repoUrl: row.repo_url,
    title: row.title,
    timePeriod: row.time_period,
    generatedAt: row.generated_at,
    summary: row.ai_overall_summary ?? null,
    highlights: summaries,
    changeMetrics: metrics,
  };
}

export function toSummaryPayload(note: SanitizedPatchNote) {
  return {
    id: note.id,
    title: note.title,
    generatedAt: note.generatedAt,
    summary: note.summary,
    highlights: note.highlights,
  };
}
