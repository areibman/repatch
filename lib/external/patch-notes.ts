import type { Database } from "@/lib/supabase/database.types";

export type SanitizedPatchNote = {
  id: string;
  title: string;
  repo_name: string;
  repo_url: string;
  time_period: Database["public"]["Enums"]["time_period_type"];
  generated_at: string;
  content: string;
  changes: { added: number; modified: number; removed: number } | null;
  contributors: string[];
  ai_overall_summary: string | null;
  ai_summaries: Database["public"]["Tables"]["patch_notes"]["Row"]["ai_summaries"];
};

type PatchNoteRow = Pick<
  Database["public"]["Tables"]["patch_notes"]["Row"],
  | "id"
  | "title"
  | "repo_name"
  | "repo_url"
  | "time_period"
  | "generated_at"
  | "content"
  | "changes"
  | "contributors"
  | "ai_overall_summary"
  | "ai_summaries"
>;

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }
  return url;
}

function getServiceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return key;
}

function sanitizeContent(value: string) {
  return value.replace(/<[^>]+>/g, "").trim();
}

function sanitizeRow(row: PatchNoteRow): SanitizedPatchNote {
  return {
    id: row.id,
    title: row.title,
    repo_name: row.repo_name,
    repo_url: row.repo_url,
    time_period: row.time_period,
    generated_at: row.generated_at,
    content: sanitizeContent(row.content),
    changes: row.changes,
    contributors: row.contributors,
    ai_overall_summary: row.ai_overall_summary?.trim() || null,
    ai_summaries: row.ai_summaries,
  };
}

async function fetchRows(url: string) {
  const response = await fetch(url, {
    headers: {
      apikey: getServiceKey(),
      Authorization: `Bearer ${getServiceKey()}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch patch notes: ${response.status}`);
  }

  const payload = (await response.json()) as PatchNoteRow[];
  return payload.map(sanitizeRow);
}

export async function getSanitizedPatchNotes(limit = 25) {
  const baseUrl = getSupabaseUrl();
  const url = `${baseUrl}/rest/v1/patch_notes?select=id,title,repo_name,repo_url,time_period,generated_at,content,changes,contributors,ai_overall_summary,ai_summaries&order=generated_at.desc&limit=${limit}`;
  return fetchRows(url);
}

export async function getSanitizedPatchNote(id: string) {
  const baseUrl = getSupabaseUrl();
  const url = `${baseUrl}/rest/v1/patch_notes?select=id,title,repo_name,repo_url,time_period,generated_at,content,changes,contributors,ai_overall_summary,ai_summaries&id=eq.${id}`;
  const rows = await fetchRows(url);
  return rows[0] ?? null;
}
