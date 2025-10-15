import { PatchNote, VideoData } from "@/types/patch-note";
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
    videoUrl: dbNote.video_url,
    githubPublishStatus: (dbNote.github_publish_status as PatchNote["githubPublishStatus"]) ?? "idle",
    githubPublishTarget: (dbNote.github_publish_target as PatchNote["githubPublishTarget"]) ?? null,
    githubPublishError: dbNote.github_publish_error,
    githubPublishedAt: dbNote.github_published_at
      ? new Date(dbNote.github_published_at)
      : null,
    githubRelease:
      dbNote.github_release_id && dbNote.github_release_url
        ? {
            id: Number(dbNote.github_release_id),
            url: dbNote.github_release_url,
          }
        : null,
    githubDiscussion:
      dbNote.github_discussion_id && dbNote.github_discussion_url
        ? {
            id: Number(dbNote.github_discussion_id),
            url: dbNote.github_discussion_url,
          }
        : null,
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
    ...(uiNote.videoUrl !== undefined && { video_url: uiNote.videoUrl }),
    ...(uiNote.githubPublishStatus && {
      github_publish_status: uiNote.githubPublishStatus,
    }),
    ...(uiNote.githubPublishTarget !== undefined && {
      github_publish_target: uiNote.githubPublishTarget ?? null,
    }),
    ...(uiNote.githubPublishError !== undefined && {
      github_publish_error: uiNote.githubPublishError ?? null,
    }),
    ...(uiNote.githubPublishedAt && {
      github_published_at: uiNote.githubPublishedAt.toISOString(),
    }),
    ...(uiNote.githubRelease !== undefined && {
      github_release_id: uiNote.githubRelease?.id ?? null,
      github_release_url: uiNote.githubRelease?.url ?? null,
    }),
    ...(uiNote.githubDiscussion !== undefined && {
      github_discussion_id: uiNote.githubDiscussion?.id ?? null,
      github_discussion_url: uiNote.githubDiscussion?.url ?? null,
    }),
  };
}
