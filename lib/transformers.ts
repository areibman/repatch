import {
  PatchNote,
  VideoData,
  GitHubPublishStatus,
} from "@/types/patch-note";
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
    videoUrl: dbNote.video_url ?? undefined,
    githubPublishTarget: dbNote.github_publish_target,
    githubPublishStatus: dbNote.github_publish_status as GitHubPublishStatus,
    githubPublishError: dbNote.github_publish_error,
    githubReleaseId: dbNote.github_release_id,
    githubReleaseUrl: dbNote.github_release_url,
    githubReleaseTag: dbNote.github_release_tag,
    githubDiscussionId: dbNote.github_discussion_id,
    githubDiscussionUrl: dbNote.github_discussion_url,
    githubDiscussionCategorySlug: dbNote.github_discussion_category_slug,
    githubPublishAttempts: dbNote.github_publish_attempts,
    githubLastPublishedAt: dbNote.github_last_published_at
      ? new Date(dbNote.github_last_published_at)
      : null,
    githubPublishNextRetryAt: dbNote.github_publish_next_retry_at
      ? new Date(dbNote.github_publish_next_retry_at)
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
    ...(uiNote.githubPublishTarget !== undefined && {
      github_publish_target: uiNote.githubPublishTarget,
    }),
    ...(uiNote.githubPublishStatus !== undefined && {
      github_publish_status: uiNote.githubPublishStatus,
    }),
    ...(uiNote.githubPublishError !== undefined && {
      github_publish_error: uiNote.githubPublishError,
    }),
    ...(uiNote.githubReleaseId !== undefined && {
      github_release_id: uiNote.githubReleaseId,
    }),
    ...(uiNote.githubReleaseUrl !== undefined && {
      github_release_url: uiNote.githubReleaseUrl,
    }),
    ...(uiNote.githubReleaseTag !== undefined && {
      github_release_tag: uiNote.githubReleaseTag,
    }),
    ...(uiNote.githubDiscussionId !== undefined && {
      github_discussion_id: uiNote.githubDiscussionId,
    }),
    ...(uiNote.githubDiscussionUrl !== undefined && {
      github_discussion_url: uiNote.githubDiscussionUrl,
    }),
    ...(uiNote.githubDiscussionCategorySlug !== undefined && {
      github_discussion_category_slug: uiNote.githubDiscussionCategorySlug,
    }),
    ...(uiNote.githubPublishAttempts !== undefined && {
      github_publish_attempts: uiNote.githubPublishAttempts,
    }),
    ...(uiNote.githubLastPublishedAt !== undefined && {
      github_last_published_at: uiNote.githubLastPublishedAt
        ? uiNote.githubLastPublishedAt.toISOString()
        : null,
    }),
    ...(uiNote.githubPublishNextRetryAt !== undefined && {
      github_publish_next_retry_at: uiNote.githubPublishNextRetryAt
        ? uiNote.githubPublishNextRetryAt.toISOString()
        : null,
    }),
  };
}
