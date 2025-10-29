import type { Database } from "@/lib/supabase/database.types";
import {
  PatchNoteSchema,
  PatchNoteRowSchema,
  type PatchNote,
  type PatchNoteRow,
  VideoDataSchema,
  CommitSummarySchema,
  DetailedContextSchema,
  PatchNoteFiltersSchema,
} from "@/lib/schemas/patch-note.schema";

type DatabaseRow = Database["public"]["Tables"]["patch_notes"]["Row"];

/**
 * Validates and converts a database row to domain type
 * Throws ZodError if validation fails
 */
export function mapPatchNoteRowToDomain(row: DatabaseRow): PatchNote {
  // First, validate the raw database row structure
  const validatedRow = PatchNoteRowSchema.parse(row);

  // Parse nested JSON fields
  const videoData = validatedRow.video_data
    ? VideoDataSchema.parse(validatedRow.video_data)
    : undefined;

  const aiSummaries = validatedRow.ai_summaries
    ? validatedRow.ai_summaries.map((s) => CommitSummarySchema.parse(s))
    : null;

  const aiDetailedContexts = validatedRow.ai_detailed_contexts
    ? validatedRow.ai_detailed_contexts.map((c) =>
        DetailedContextSchema.parse(c)
      )
    : null;

  const filterMetadata = validatedRow.filter_metadata
    ? PatchNoteFiltersSchema.parse(validatedRow.filter_metadata)
    : null;

  const videoTopChanges = validatedRow.video_top_changes
    ? validatedRow.video_top_changes.map((tc) => ({
        title: String(tc.title || ""),
        description: String(tc.description || ""),
      }))
    : null;

  // Map to domain format
  const domain: PatchNote = {
    id: validatedRow.id,
    repoName: validatedRow.repo_name,
    repoUrl: validatedRow.repo_url,
    repoBranch: validatedRow.repo_branch ?? undefined,
    timePeriod: validatedRow.time_period,
    generatedAt: new Date(validatedRow.generated_at),
    title: validatedRow.title,
    content: validatedRow.content ?? "",
    changes: validatedRow.changes as {
      added: number;
      modified: number;
      removed: number;
    },
    contributors: validatedRow.contributors,
    videoData,
    videoUrl: validatedRow.video_url ?? undefined,
    aiSummaries: aiSummaries ?? undefined,
    aiOverallSummary: validatedRow.ai_overall_summary ?? undefined,
    aiDetailedContexts: aiDetailedContexts ?? undefined,
    aiTemplateId: validatedRow.ai_template_id ?? undefined,
    filterMetadata: filterMetadata ?? undefined,
    videoTopChanges: videoTopChanges ?? undefined,
    processingStatus: validatedRow.processing_status ?? undefined,
    processingStage: validatedRow.processing_stage ?? undefined,
    processingError: validatedRow.processing_error ?? undefined,
    processingProgress: validatedRow.processing_progress ?? undefined,
  };

  // Final validation of domain object
  return PatchNoteSchema.parse(domain);
}

/**
 * Converts domain type to database insert format
 */
export function mapPatchNoteDomainToInsert(
  domain: Partial<PatchNote>
): Database["public"]["Tables"]["patch_notes"]["Insert"] {
  return {
    repo_name: domain.repoName,
    repo_url: domain.repoUrl,
    repo_branch: domain.repoBranch ?? null,
    time_period: domain.timePeriod,
    generated_at: domain.generatedAt?.toISOString(),
    title: domain.title,
    content: domain.content ?? null,
    changes: domain.changes as Record<string, unknown>,
    contributors: domain.contributors,
    video_data: domain.videoData as Record<string, unknown> | null,
    video_url: domain.videoUrl ?? null,
    ai_summaries: domain.aiSummaries as unknown[] | null,
    ai_overall_summary: domain.aiOverallSummary ?? null,
    ai_detailed_contexts: domain.aiDetailedContexts as unknown[] | null,
    ai_template_id: domain.aiTemplateId ?? null,
    filter_metadata: domain.filterMetadata as Record<string, unknown> | null,
    video_top_changes: domain.videoTopChanges as unknown[] | null,
    processing_status: domain.processingStatus ?? null,
    processing_stage: domain.processingStage ?? null,
    processing_error: domain.processingError ?? null,
    processing_progress: domain.processingProgress ?? null,
  };
}

/**
 * Converts domain type to database update format
 */
export function mapPatchNoteDomainToUpdate(
  domain: Partial<PatchNote>
): Database["public"]["Tables"]["patch_notes"]["Update"] {
  const update: Database["public"]["Tables"]["patch_notes"]["Update"] = {};

  if (domain.repoName !== undefined) update.repo_name = domain.repoName;
  if (domain.repoUrl !== undefined) update.repo_url = domain.repoUrl;
  if (domain.repoBranch !== undefined)
    update.repo_branch = domain.repoBranch ?? null;
  if (domain.timePeriod !== undefined) update.time_period = domain.timePeriod;
  if (domain.generatedAt !== undefined)
    update.generated_at = domain.generatedAt.toISOString();
  if (domain.title !== undefined) update.title = domain.title;
  if (domain.content !== undefined) update.content = domain.content ?? null;
  if (domain.changes !== undefined)
    update.changes = domain.changes as Record<string, unknown>;
  if (domain.contributors !== undefined)
    update.contributors = domain.contributors;
  if (domain.videoData !== undefined)
    update.video_data = domain.videoData as Record<string, unknown> | null;
  if (domain.videoUrl !== undefined)
    update.video_url = domain.videoUrl ?? null;
  if (domain.aiSummaries !== undefined)
    update.ai_summaries = domain.aiSummaries as unknown[] | null;
  if (domain.aiOverallSummary !== undefined)
    update.ai_overall_summary = domain.aiOverallSummary ?? null;
  if (domain.aiDetailedContexts !== undefined)
    update.ai_detailed_contexts =
      domain.aiDetailedContexts as unknown[] | null;
  if (domain.aiTemplateId !== undefined)
    update.ai_template_id = domain.aiTemplateId ?? null;
  if (domain.filterMetadata !== undefined)
    update.filter_metadata = domain.filterMetadata as Record<string, unknown> | null;
  if (domain.videoTopChanges !== undefined)
    update.video_top_changes = domain.videoTopChanges as unknown[] | null;
  if (domain.processingStatus !== undefined)
    update.processing_status = domain.processingStatus ?? null;
  if (domain.processingStage !== undefined)
    update.processing_stage = domain.processingStage ?? null;
  if (domain.processingError !== undefined)
    update.processing_error = domain.processingError ?? null;
  if (domain.processingProgress !== undefined)
    update.processing_progress = domain.processingProgress ?? null;

  return update;
}

/**
 * Safely validates and converts a database row, returning a result object
 */
export function safeMapPatchNoteRowToDomain(
  row: DatabaseRow
): { success: true; data: PatchNote } | { success: false; error: unknown } {
  try {
    const data = mapPatchNoteRowToDomain(row);
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
}
