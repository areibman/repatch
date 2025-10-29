import { z } from "zod";

// Enums - runtime validated
export const ProcessingStatusSchema = z.enum([
  "pending",
  "fetching_stats",
  "analyzing_commits",
  "generating_content",
  "generating_video",
  "completed",
  "failed",
]);

export const TimePeriodSchema = z.enum([
  "1day",
  "1week",
  "1month",
  "custom",
  "release",
]);

export const FilterModeSchema = z.enum(["preset", "custom", "release"]);

// Nested schemas
export const VideoDataSchema = z.object({
  langCode: z.string(),
  topChanges: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
    })
  ),
  allChanges: z.array(z.string()),
});

export const CommitSummarySchema = z.object({
  sha: z.string(),
  message: z.string(),
  aiSummary: z.string(),
  aiTitle: z.string().optional(),
  additions: z.number(),
  deletions: z.number(),
});

export const DetailedContextSchema = z.object({
  context: z.string(),
  message: z.string(),
  additions: z.number(),
  deletions: z.number(),
  authors: z.array(z.string()),
  prNumber: z.number().optional(),
});

export const PatchNoteFiltersSchema = z.object({
  mode: FilterModeSchema,
  preset: z.enum(["1day", "1week", "1month"]).optional(),
  customRange: z
    .object({
      since: z.string(),
      until: z.string(),
    })
    .optional(),
  includeLabels: z.array(z.string()).optional(),
  excludeLabels: z.array(z.string()).optional(),
  includeTags: z.array(z.string()).optional(),
  excludeTags: z.array(z.string()).optional(),
  releases: z
    .array(
      z.object({
        tag: z.string(),
        name: z.string().nullable().optional(),
        previousTag: z.string().nullable().optional(),
        publishedAt: z.string().nullable().optional(),
        targetCommitish: z.string().nullable().optional(),
      })
    )
    .optional(),
});

// Main domain schema - matches PatchNote interface
export const PatchNoteSchema = z.object({
  id: z.string(),
  repoName: z.string(),
  repoUrl: z.string(),
  timePeriod: TimePeriodSchema,
  generatedAt: z.date(),
  title: z.string(),
  content: z.string(),
  changes: z.object({
    added: z.number(),
    modified: z.number(),
    removed: z.number(),
  }),
  contributors: z.array(z.string()),
  videoData: VideoDataSchema.optional(),
  videoUrl: z.string().nullable().optional(),
  repoBranch: z.string().nullable().optional(),
  aiSummaries: z.array(CommitSummarySchema).nullable().optional(),
  aiOverallSummary: z.string().nullable().optional(),
  aiDetailedContexts: z.array(DetailedContextSchema).nullable().optional(),
  aiTemplateId: z.string().nullable().optional(),
  filterMetadata: PatchNoteFiltersSchema.nullable().optional(),
  videoTopChanges: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
      })
    )
    .nullable()
    .optional(),
  processingStatus: ProcessingStatusSchema.optional(),
  processingStage: z.string().nullable().optional(),
  processingError: z.string().nullable().optional(),
  processingProgress: z.number().nullable().optional(),
});

// Database row schema - matches Supabase row structure
export const PatchNoteRowSchema = z.object({
  id: z.string(),
  repo_name: z.string(),
  repo_url: z.string(),
  repo_branch: z.string().nullable(),
  time_period: TimePeriodSchema,
  generated_at: z.string(), // ISO string
  title: z.string(),
  content: z.string().nullable(),
  changes: z.record(z.unknown()), // Json type
  contributors: z.array(z.string()),
  video_data: z.record(z.unknown()).nullable(), // Json type
  video_url: z.string().nullable(),
  video_bucket_name: z.string().nullable(),
  video_render_id: z.string().nullable(),
  ai_summaries: z.array(z.record(z.unknown())).nullable(), // Json type
  ai_overall_summary: z.string().nullable(),
  ai_detailed_contexts: z.array(z.record(z.unknown())).nullable(), // Json type
  ai_template_id: z.string().nullable(),
  filter_metadata: z.record(z.unknown()).nullable(), // Json type
  video_top_changes: z.array(z.record(z.unknown())).nullable(), // Json type
  processing_status: ProcessingStatusSchema.nullable(),
  processing_stage: z.string().nullable(),
  processing_error: z.string().nullable(),
  processing_progress: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Type exports derived from schemas
export type ProcessingStatus = z.infer<typeof ProcessingStatusSchema>;
export type TimePeriod = z.infer<typeof TimePeriodSchema>;
export type FilterMode = z.infer<typeof FilterModeSchema>;
export type VideoData = z.infer<typeof VideoDataSchema>;
export type CommitSummary = z.infer<typeof CommitSummarySchema>;
export type DetailedContext = z.infer<typeof DetailedContextSchema>;
export type PatchNoteFilters = z.infer<typeof PatchNoteFiltersSchema>;
export type PatchNote = z.infer<typeof PatchNoteSchema>;
export type PatchNoteRow = z.infer<typeof PatchNoteRowSchema>;
