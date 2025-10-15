export interface VideoData {
  langCode: string;
  topChanges: Array<{
    title: string;
    description: string;
  }>;
  allChanges: string[];
}

export type TimePreset = "1day" | "1week" | "1month";

export type FilterMode = "preset" | "custom" | "release";

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
  filterMetadata?: PatchNoteFilters | null;
}
