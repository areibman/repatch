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
  timePeriod: "1day" | "1week" | "1month" | "custom" | "release";
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
  filterMetadata?: PatchNoteFilters;
}

export type TimePreset = "1day" | "1week" | "1month";

export interface DateRangeFilter {
  since: string;
  until: string;
}

export interface ReleaseFilter {
  base: string;
  head: string;
}

export interface PatchNoteFilters {
  preset?: TimePreset;
  customRange?: DateRangeFilter;
  releaseRange?: ReleaseFilter;
  includeTags?: string[];
  excludeTags?: string[];
}
