import type { Database } from "./supabase/database.types";
import { createServiceClient } from "./supabase/service";

type PatchNotesTable = Database["public"]["Tables"]["patch_notes"];

type RawPatchNote = PatchNotesTable["Row"];

type ChangeMetrics = RawPatchNote["changes"] & {
  added: number;
  modified: number;
  removed: number;
};

export type ExternalPatchNote = {
  id: string;
  title: string;
  repo: {
    name: string;
    url: string;
  };
  summary: string;
  generatedAt: string;
  timePeriod: RawPatchNote["time_period"];
  contributors: string[];
  metrics: ChangeMetrics;
  highlights: string[];
};

let useMockData = process.env.NODE_ENV === "test";
let mockPatchNotes: ExternalPatchNote[] = [];

function normalizeSummary(note: RawPatchNote): string {
  const summary = note.ai_overall_summary ?? "";
  if (summary.trim().length > 0) {
    return summary.trim();
  }

  const stripped = note.content.replace(/\s+/g, " ").trim();
  return stripped.length > 240 ? `${stripped.slice(0, 240)}…` : stripped;
}

function normalizeHighlights(note: RawPatchNote): string[] {
  const raw = note.ai_summaries as unknown;
  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }
        if (entry && typeof entry === "object") {
          const candidate =
            (entry as Record<string, unknown>).summary ??
            (entry as Record<string, unknown>).title ??
            (entry as Record<string, unknown>).heading;
          return typeof candidate === "string" ? candidate : "";
        }
        return "";
      })
      .filter((value): value is string => value.length > 0)
      .slice(0, 5);
  }

  if (typeof raw === "object") {
    const values = Object.values(raw as Record<string, unknown>);
    return values
      .map((value) => (typeof value === "string" ? value : ""))
      .filter((value): value is string => value.length > 0)
      .slice(0, 5);
  }

  return [];
}

function sanitize(note: RawPatchNote): ExternalPatchNote {
  return {
    id: note.id,
    title: note.title,
    repo: {
      name: note.repo_name,
      url: note.repo_url,
    },
    summary: normalizeSummary(note),
    generatedAt: note.generated_at,
    timePeriod: note.time_period,
    contributors: note.contributors ?? [],
    metrics: {
      added: note.changes?.added ?? 0,
      modified: note.changes?.modified ?? 0,
      removed: note.changes?.removed ?? 0,
    },
    highlights: normalizeHighlights(note),
  };
}

function shouldUseMock() {
  return useMockData;
}

export function __setUseMockExternalPatchNotes(enabled: boolean) {
  useMockData = enabled;
}

export function __setMockExternalPatchNotes(data: ExternalPatchNote[]) {
  mockPatchNotes = data;
}

export function __resetMockExternalPatchNotes() {
  mockPatchNotes = [];
}

async function fetchSupabasePatchNotes() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("patch_notes")
    .select(
      "id, repo_name, repo_url, time_period, title, ai_overall_summary, ai_summaries, generated_at, contributors, changes, content"
    )
    .order("generated_at", { ascending: false });

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to load patch notes");
  }

  return data.map((row) => sanitize(row as RawPatchNote));
}

async function fetchSupabasePatchNote(id: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("patch_notes")
    .select(
      "id, repo_name, repo_url, time_period, title, ai_overall_summary, ai_summaries, generated_at, contributors, changes, content"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? sanitize(data as RawPatchNote) : null;
}

export async function fetchSanitizedPatchNotes(limit?: number) {
  if (shouldUseMock() && mockPatchNotes.length > 0) {
    return typeof limit === "number"
      ? mockPatchNotes.slice(0, limit)
      : [...mockPatchNotes];
  }

  const notes = await fetchSupabasePatchNotes();
  return typeof limit === "number" ? notes.slice(0, limit) : notes;
}

export async function fetchSanitizedPatchNote(id: string) {
  if (shouldUseMock() && mockPatchNotes.length > 0) {
    return mockPatchNotes.find((note) => note.id === id) ?? null;
  }

  return fetchSupabasePatchNote(id);
}
