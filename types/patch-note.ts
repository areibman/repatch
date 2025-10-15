export interface VideoData {
  langCode: string;
  topChanges: Array<{
    title: string;
    description: string;
  }>;
  allChanges: string[];
}

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
  githubPublishStatus: "idle" | "pending" | "published" | "failed" | "partial";
  githubPublishTarget?: "release" | "discussion" | "both" | null;
  githubPublishError?: string | null;
  githubPublishedAt?: Date | null;
  githubRelease?: { id: number; url: string } | null;
  githubDiscussion?: { id: number; url: string } | null;
}
