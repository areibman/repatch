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
  additions: number;
  deletions: number;
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
  repoBranch?: string | null;
  aiSummaries?: CommitSummary[] | null;
  aiOverallSummary?: string | null;
  aiTemplateId?: string | null;
  aiTemplate?: AiTemplate;
}
