import { PatchNote, PatchNoteFilters, VideoData } from "@/types/patch-note";
import { Database } from "@/lib/supabase/database.types";

type DbPatchNote = Database["public"]["Tables"]["patch_notes"]["Row"];
type DbPatchNoteInsert = Database["public"]["Tables"]["patch_notes"]["Insert"];

/**
 * Transform database patch note format to UI format
 */
export function dbToUiPatchNote(dbNote: DbPatchNote): PatchNote {
  return {
    id: dbNote.id,
    repoName: dbNote.repo_name,
    repoUrl: dbNote.repo_url,
    timePeriod: dbNote.time_period,
    generatedAt: new Date(dbNote.generated_at),
    title: dbNote.title,
    content: dbNote.content,
    changes: dbNote.changes,
    contributors: dbNote.contributors,
    videoData: dbNote.video_data as unknown as VideoData | undefined,
    filterMetadata: dbNote.filter_metadata as PatchNoteFilters | undefined,
  };
}

/**
 * Transform UI patch note format to database insert format
 */
export function uiToDbPatchNote(
  uiNote: Partial<PatchNote>
): Partial<DbPatchNoteInsert> {
  return {
    ...(uiNote.id && { id: uiNote.id }),
    ...(uiNote.repoName && { repo_name: uiNote.repoName }),
    ...(uiNote.repoUrl && { repo_url: uiNote.repoUrl }),
    ...(uiNote.timePeriod && { time_period: uiNote.timePeriod }),
    ...(uiNote.generatedAt && {
      generated_at: uiNote.generatedAt.toISOString(),
    }),
    ...(uiNote.title && { title: uiNote.title }),
    ...(uiNote.content !== undefined && { content: uiNote.content }),
    ...(uiNote.changes && { changes: uiNote.changes }),
    ...(uiNote.contributors && { contributors: uiNote.contributors }),
    ...(uiNote.videoData !== undefined && {
      video_data: uiNote.videoData as unknown as any,
    }),
    ...(uiNote.filterMetadata !== undefined && {
      filter_metadata: uiNote.filterMetadata as unknown as any,
    }),
  };
}
