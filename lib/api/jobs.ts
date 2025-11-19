/**
 * Job Management API
 * Core logic for async operation tracking
 */

import { createServiceSupabaseClient } from '@/lib/supabase';

export type JobType = 'video_render' | 'ai_process' | 'commit_summarize';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  metadata?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  resource_type?: string;
  resource_id?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface CreateJobInput {
  type: JobType;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateJobInput {
  status?: JobStatus;
  progress?: number;
  metadata?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
}

/**
 * Create a new job
 */
export async function createJob(input: CreateJobInput): Promise<Job> {
  const supabase = createServiceSupabaseClient();

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      type: input.type,
      status: 'pending',
      progress: 0,
      resource_type: input.resource_type,
      resource_id: input.resource_id,
      metadata: input.metadata,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create job: ${error?.message || 'Unknown error'}`);
  }

  return data as Job;
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
  const supabase = createServiceSupabaseClient();

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch job: ${error.message}`);
  }

  return data as Job;
}

/**
 * Update job
 */
export async function updateJob(jobId: string, input: UpdateJobInput): Promise<Job> {
  const supabase = createServiceSupabaseClient();

  const updateData: Record<string, unknown> = {};
  if (input.status !== undefined) {
    updateData.status = input.status;
    if (input.status === 'completed' || input.status === 'failed' || input.status === 'cancelled') {
      updateData.completed_at = new Date().toISOString();
    }
  }
  if (input.progress !== undefined) updateData.progress = input.progress;
  if (input.metadata !== undefined) updateData.metadata = input.metadata;
  if (input.result !== undefined) updateData.result = input.result;
  if (input.error !== undefined) updateData.error = input.error;

  const { data, error } = await supabase
    .from('jobs')
    .update(updateData)
    .eq('id', jobId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update job: ${error?.message || 'Unknown error'}`);
  }

  return data as Job;
}

/**
 * Get jobs for a resource
 */
export async function getJobsForResource(
  resourceType: string,
  resourceId: string
): Promise<Job[]> {
  const supabase = createServiceSupabaseClient();

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch jobs: ${error.message}`);
  }

  return (data || []) as Job[];
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<Job> {
  const job = await getJob(jobId);
  
  if (!job) {
    throw new Error('Job not found');
  }

  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    throw new Error(`Job cannot be cancelled (status: ${job.status})`);
  }

  return updateJob(jobId, {
    status: 'cancelled',
    error: 'Cancelled by user',
  });
}
