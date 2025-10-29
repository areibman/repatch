// Re-export validated types from schemas for runtime validation
export type {
  VideoData,
  CommitSummary,
  DetailedContext,
  TimePeriod as TimePreset,
  FilterMode,
  ProcessingStatus,
  PatchNoteFilters,
  PatchNote,
} from "@/lib/schemas/patch-note.schema";

// Export schemas for runtime validation
export {
  ProcessingStatusSchema,
  TimePeriodSchema,
  FilterModeSchema,
  VideoDataSchema,
  CommitSummarySchema,
  DetailedContextSchema,
  PatchNoteFiltersSchema,
  PatchNoteSchema,
} from "@/lib/schemas/patch-note.schema";

// Type alias for backward compatibility
export type TimePreset = "1day" | "1week" | "1month";
