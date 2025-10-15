export interface VideoData {
  langCode: string;
  topChanges: Array<{
    title: string;
    description: string;
  }>;
  allChanges: string[];
}

export type GitHubPublishTarget = "release" | "discussion";
export type GitHubPublishStatus =
  | "idle"
  | "publishing"
  | "published"
  | "failed";

export interface PatchNote {
  id: string;
  repoName: string;
  repoUrl: string;
  timePeriod: "1day" | "1week" | "1month";
  generatedAt: Date;
  title: string;
  content: string;
  changes: {
    added: number;
    modified: number;
    removed: number;
  };
  contributors: string[];
  videoData?: VideoData;
  videoUrl?: string | null;
  githubPublishTarget?: GitHubPublishTarget | null;
  githubPublishStatus?: GitHubPublishStatus;
  githubPublishError?: string | null;
  githubReleaseId?: string | null;
  githubReleaseUrl?: string | null;
  githubReleaseTag?: string | null;
  githubDiscussionId?: string | null;
  githubDiscussionUrl?: string | null;
  githubDiscussionCategorySlug?: string | null;
  githubPublishAttempts?: number;
  githubLastPublishedAt?: Date | null;
  githubPublishNextRetryAt?: Date | null;
}
