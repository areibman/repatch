export interface VideoData {
  langCode: string;
  topChanges: Array<{
    title: string;
    description: string;
  }>;
  allChanges: string[];
}

export type TimePreset = "1day" | "1week" | "1month";
export type TimePeriod = TimePreset | "custom" | "release";

export interface PatchNoteFilters {
  preset?: TimePreset;
  customRange?: {
    since: string;
    until: string;
  };
  includeTags?: string[];
  excludeTags?: string[];
  releaseTag?: string;
  releaseBaseTag?: string | null;
  branch?: string;
}

export interface PatchNote {
  id: string;
  repoName: string;
  repoUrl: string;
  timePeriod: TimePeriod;
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
  filters?: PatchNoteFilters | null;
}
