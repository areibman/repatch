/**
 * Job types and interfaces for async operations
 */

export type JobType = 
  | 'process-patch-note'
  | 'render-video'
  | 'generate-video-top-changes';

export type JobStatus = 
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Job<TParams = unknown, TResult = unknown> {
  readonly id: string;
  readonly type: JobType;
  readonly status: JobStatus;
  readonly params: TParams;
  readonly result?: TResult;
  readonly error?: string;
  readonly progress: number; // 0-100
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt?: Date;
  readonly callbackUrl?: string;
}

export interface CreateJobInput<TParams = unknown> {
  readonly type: JobType;
  readonly params: TParams;
  readonly callbackUrl?: string;
}

export interface UpdateJobInput {
  readonly id: string;
  readonly status?: JobStatus;
  readonly progress?: number;
  readonly result?: unknown;
  readonly error?: string;
}

// Job-specific parameter types

export interface ProcessPatchNoteJobParams {
  readonly patchNoteId: string;
  readonly owner: string;
  readonly repo: string;
  readonly repoUrl: string;
  readonly branch?: string;
  readonly filters: unknown; // PatchNoteFilters
  readonly templateId?: string;
}

export interface RenderVideoJobParams {
  readonly patchNoteId: string;
}

export interface GenerateVideoTopChangesJobParams {
  readonly content: string;
  readonly repoName: string;
}

// Job result types

export interface ProcessPatchNoteJobResult {
  readonly patchNoteId: string;
  readonly status: string;
}

export interface RenderVideoJobResult {
  readonly videoUrl: string;
  readonly renderId: string;
}

export interface GenerateVideoTopChangesJobResult {
  readonly topChanges: Array<{
    readonly title: string;
    readonly description: string;
  }>;
}
