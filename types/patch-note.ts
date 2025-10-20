export type PatchNoteTimePreset = "1day" | "1week" | "1month" | "custom";

export type PatchNoteFilterMode = "preset" | "custom" | "release";

export interface PatchNoteFilterMetadata {
  mode: PatchNoteFilterMode;
  preset?: Exclude<PatchNoteTimePreset, "custom">;
  customRange?: {
    since: string;
    until: string;
  };
  releaseRange?: {
    baseTag?: string | null;
    headTag: string;
  };
  includeLabels?: string[];
  excludeLabels?: string[];
  branch?: string | null;
}

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
  timePeriod: PatchNoteTimePreset;
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
  filterMetadata?: PatchNoteFilterMetadata | null;
}
