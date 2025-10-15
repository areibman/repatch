export interface VideoData {
  langCode: string;
  topChanges: Array<{
    title: string;
    description: string;
  }>;
  allChanges: string[];
}

export type GitHubPublishStatus =
  | "idle"
  | "publishing"
  | "published"
  | "failed";

export type GitHubPublishTarget = "release" | "discussion";

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
  githubPublishStatus: GitHubPublishStatus;
  githubPublishTarget?: GitHubPublishTarget | null;
  githubReleaseId?: string | null;
  githubReleaseUrl?: string | null;
  githubDiscussionId?: string | null;
  githubDiscussionUrl?: string | null;
  githubPublishAttemptedAt?: Date | null;
  githubPublishCompletedAt?: Date | null;
  githubPublishError?: string | null;
}
