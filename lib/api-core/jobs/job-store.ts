/**
 * In-memory job store
 * TODO: Replace with persistent storage (Redis, PostgreSQL, etc.)
 */

import type { Job, JobStatus, CreateJobInput, UpdateJobInput } from '../types/job';
import type { Result } from '../types/result';
import { success, error } from '../types/result';

// In-memory storage (replace with database in production)
const jobs = new Map<string, Job>();

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new job
 */
export function createJob<TParams>(
  input: CreateJobInput<TParams>
): Result<Job<TParams>> {
  try {
    const now = new Date();
    const job: Job<TParams> = {
      id: generateJobId(),
      type: input.type,
      status: 'queued',
      params: input.params,
      progress: 0,
      createdAt: now,
      updatedAt: now,
      callbackUrl: input.callbackUrl,
    };

    jobs.set(job.id, job as Job);
    return success(job);
  } catch (err) {
    return error('Failed to create job');
  }
}

/**
 * Get a job by ID
 */
export function getJob(id: string): Result<Job> {
  const job = jobs.get(id);
  if (!job) {
    return error('Job not found');
  }
  return success(job);
}

/**
 * List all jobs (with optional filtering)
 */
export function listJobs(filters?: {
  type?: string;
  status?: JobStatus;
}): Result<Job[]> {
  try {
    let jobList = Array.from(jobs.values());

    if (filters?.type) {
      jobList = jobList.filter(job => job.type === filters.type);
    }

    if (filters?.status) {
      jobList = jobList.filter(job => job.status === filters.status);
    }

    // Sort by creation date (newest first)
    jobList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return success(jobList);
  } catch (err) {
    return error('Failed to list jobs');
  }
}

/**
 * Update a job
 */
export function updateJob(input: UpdateJobInput): Result<Job> {
  const job = jobs.get(input.id);
  if (!job) {
    return error('Job not found');
  }

  const updatedJob: Job = {
    ...job,
    status: input.status ?? job.status,
    progress: input.progress ?? job.progress,
    result: input.result ?? job.result,
    error: input.error ?? job.error,
    updatedAt: new Date(),
    completedAt: 
      (input.status === 'completed' || input.status === 'failed') && !job.completedAt
        ? new Date()
        : job.completedAt,
  };

  jobs.set(input.id, updatedJob);
  return success(updatedJob);
}

/**
 * Delete a job (cancel)
 */
export function deleteJob(id: string): Result<boolean> {
  const job = jobs.get(id);
  if (!job) {
    return error('Job not found');
  }

  // Can only cancel queued or processing jobs
  if (job.status !== 'queued' && job.status !== 'processing') {
    return error('Job cannot be cancelled');
  }

  // Update status to cancelled instead of deleting
  const cancelledJob: Job = {
    ...job,
    status: 'cancelled',
    updatedAt: new Date(),
    completedAt: new Date(),
  };

  jobs.set(id, cancelledJob);
  return success(true);
}

/**
 * Clean up old completed jobs
 * Call this periodically to prevent memory growth
 */
export function cleanupJobs(olderThanHours: number = 24): Result<number> {
  try {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let count = 0;

    for (const [id, job] of jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
        job.completedAt &&
        job.completedAt < cutoff
      ) {
        jobs.delete(id);
        count++;
      }
    }

    return success(count);
  } catch (err) {
    return error('Failed to clean up jobs');
  }
}
