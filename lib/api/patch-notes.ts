/**
 * Patch Notes API Layer
 * Pure business logic separated from HTTP concerns
 */

import { createServiceSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import type { ServiceResult } from '@/lib/services/github-stats.service';
import { processPatchNote, type ProcessPatchNoteInput } from '@/lib/services';
import { startVideoRender, getVideoRenderStatus } from '@/lib/remotion-lambda-renderer';
import { createJob, updateJob, type Job } from './jobs';

type PatchNote = Database['public']['Tables']['patch_notes']['Row'];
type PatchNoteInsert = Database['public']['Tables']['patch_notes']['Insert'];
type PatchNoteUpdate = Database['public']['Tables']['patch_notes']['Update'];

/**
 * List all patch notes
 */
export async function listPatchNotes(
  limit: number = 50,
  offset: number = 0
): Promise<ServiceResult<PatchNote[]>> {
  try {
    const supabase = createServiceSupabaseClient();

    const { data, error } = await supabase
      .from('patch_notes')
      .select('*')
      .order('generated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch patch notes',
    };
  }
}

/**
 * Get a single patch note
 */
export async function getPatchNote(id: string): Promise<ServiceResult<PatchNote>> {
  try {
    const supabase = createServiceSupabaseClient();

    const { data, error } = await supabase
      .from('patch_notes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch patch note',
    };
  }
}

/**
 * Create a new patch note
 */
export async function createPatchNote(
  input: PatchNoteInsert
): Promise<ServiceResult<PatchNote>> {
  try {
    const supabase = createServiceSupabaseClient();

    const { data, error } = await supabase
      .from('patch_notes')
      .insert(input)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create patch note',
    };
  }
}

/**
 * Update a patch note
 */
export async function updatePatchNote(
  id: string,
  input: PatchNoteUpdate
): Promise<ServiceResult<PatchNote>> {
  try {
    const supabase = createServiceSupabaseClient();

    const { data, error } = await supabase
      .from('patch_notes')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update patch note',
    };
  }
}

/**
 * Delete a patch note
 */
export async function deletePatchNote(id: string): Promise<ServiceResult<{ success: boolean }>> {
  try {
    const supabase = createServiceSupabaseClient();

    const { error } = await supabase.from('patch_notes').delete().eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: { success: true } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete patch note',
    };
  }
}

/**
 * Start processing job for a patch note
 * Returns a job ID for polling
 */
export async function startProcessJob(
  input: ProcessPatchNoteInput
): Promise<ServiceResult<Job>> {
  try {
    // Create job record
    const job = await createJob({
      type: 'ai_process',
      resource_type: 'patch_note',
      resource_id: input.patchNoteId,
      metadata: {
        owner: input.owner,
        repo: input.repo,
        branch: input.branch,
      },
    });

    // Start async processing (fire-and-forget)
    processInBackground(job.id, input);

    return { success: true, data: job };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start process job',
    };
  }
}

/**
 * Background processing handler
 */
async function processInBackground(jobId: string, input: ProcessPatchNoteInput) {
  try {
    await updateJob(jobId, { status: 'running', progress: 10 });

    const result = await processPatchNote(input);

    if (result.success) {
      await updateJob(jobId, {
        status: 'completed',
        progress: 100,
        result: result.data,
      });
    } else {
      await updateJob(jobId, {
        status: 'failed',
        error: result.error,
      });
    }
  } catch (error) {
    await updateJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Start video render job
 * Returns a job ID for polling
 */
export async function startVideoRenderJob(patchNoteId: string): Promise<ServiceResult<Job>> {
  try {
    // Create job record
    const job = await createJob({
      type: 'video_render',
      resource_type: 'patch_note',
      resource_id: patchNoteId,
    });

    // Start video render (fire-and-forget)
    renderVideoInBackground(job.id, patchNoteId);

    return { success: true, data: job };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start video render job',
    };
  }
}

/**
 * Background video render handler
 */
async function renderVideoInBackground(jobId: string, patchNoteId: string) {
  try {
    await updateJob(jobId, { status: 'running', progress: 5 });

    const result = await startVideoRender(patchNoteId);

    // Store render metadata
    await updateJob(jobId, {
      progress: 10,
      metadata: {
        renderId: result.renderId,
        bucketName: result.bucketName,
      },
    });

    // Poll for completion
    await pollVideoRender(jobId, patchNoteId);
  } catch (error) {
    await updateJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Poll video render status until complete
 */
async function pollVideoRender(jobId: string, patchNoteId: string) {
  const maxAttempts = 60; // 5 minutes max (5s intervals)
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

    const status = await getVideoRenderStatus(patchNoteId);

    if (status.status === 'completed') {
      await updateJob(jobId, {
        status: 'completed',
        progress: 100,
        result: { videoUrl: status.videoUrl },
      });
      return;
    }

    if (status.status === 'failed') {
      await updateJob(jobId, {
        status: 'failed',
        error: status.error || 'Video render failed',
      });
      return;
    }

    // Update progress
    await updateJob(jobId, {
      progress: Math.min(95, 10 + status.progress * 0.85),
    });

    attempts++;
  }

  // Timeout
  await updateJob(jobId, {
    status: 'failed',
    error: 'Video render timeout',
  });
}
