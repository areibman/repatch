import { CommitSummary } from "@/lib/ai-summarizer";
import { AiTemplate } from "@/types/ai-template";

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
  aiSummaries?: CommitSummary[] | null;
  aiOverallSummary?: string | null;
  templateId?: string | null;
  template?: AiTemplate | null;
  branch?: string | null;
}
