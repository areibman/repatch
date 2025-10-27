import type { AiTemplate } from "./ai-template";

export interface VideoData {
  langCode: string;
  topChanges: Array<{
    title: string;
    description: string;
  }>;
  allChanges: string[];
}

export interface CommitSummary {
  sha: string;
  message: string;
  aiSummary: string;
  aiTitle?: string;
  additions: number;
  deletions: number;
}

export interface DetailedContext {
  context: string;
  message: string;
  additions: number;
  deletions: number;
  authors: string[];
  prNumber?: number;
}

export type TimePreset = "1day" | "1week" | "1month";

export type FilterMode = "preset" | "custom" | "release";

export type ProcessingStatus = "pending" | "fetching_stats" | "analyzing_commits" | "generating_content" | "generating_video" | "completed" | "failed";

export interface PatchNoteFilters {
  mode: FilterMode;
  preset?: TimePreset;
  customRange?: {
    since: string;
    until: string;
  };
  includeLabels?: string[];
  excludeLabels?: string[];
  includeTags?: string[];
  excludeTags?: string[];
  releases?: Array<{
    tag: string;
    name?: string | null;
    previousTag?: string | null;
    publishedAt?: string | null;
    targetCommitish?: string | null;
  }>;
}

export interface PatchNote {
  id: string;
  repoName: string;
  repoUrl: string;
  timePeriod: TimePreset | "custom" | "release";
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
  repoBranch?: string | null;
  aiSummaries?: CommitSummary[] | null;
  aiOverallSummary?: string | null;
  aiDetailedContexts?: DetailedContext[] | null;
  aiTemplateId?: string | null;
  aiTemplate?: AiTemplate;
  filterMetadata?: PatchNoteFilters | null;
  videoTopChanges?: Array<{ title: string; description: string }> | null;
  processingStatus?: ProcessingStatus;
  processingStage?: string | null;
  processingError?: string | null;
}
