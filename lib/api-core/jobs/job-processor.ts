/**
 * Job processor for async operations
 * Handles execution of different job types
 */

import type { Job } from '../types/job';
import type { Result } from '../types/result';
import { error } from '../types/result';
import { updateJob } from './job-store';

// Import job handlers
import { processPatchNote } from '@/lib/services/patch-note-processor.service';
import { renderVideo } from '@/lib/services/video-render.service';
import { generateVideoTopChangesFromContent } from '@/lib/ai-summarizer';
import type { 
  ProcessPatchNoteJobParams,
  RenderVideoJobParams,
  GenerateVideoTopChangesJobParams 
} from '../types/job';

/**
 * Process a job based on its type
 */
export async function processJob(job: Job): Promise<Result<unknown>> {
  console.log(`🔄 Processing job ${job.id} (${job.type})`);

  // Update status to processing
  updateJob({
    id: job.id,
    status: 'processing',
    progress: 10,
  });

  try {
    let result: Result<unknown>;

    switch (job.type) {
      case 'process-patch-note':
        result = await processProcessPatchNoteJob(job as Job<ProcessPatchNoteJobParams>);
        break;

      case 'render-video':
        result = await processRenderVideoJob(job as Job<RenderVideoJobParams>);
        break;

      case 'generate-video-top-changes':
        result = await processGenerateVideoTopChangesJob(job as Job<GenerateVideoTopChangesJobParams>);
        break;

      default:
        result = error(`Unknown job type: ${job.type}`);
    }

    if (result.success) {
      updateJob({
        id: job.id,
        status: 'completed',
        progress: 100,
        result: result.data,
      });

      // Call webhook if provided
      if (job.callbackUrl) {
        await callWebhook(job.callbackUrl, {
          jobId: job.id,
          type: job.type,
          status: 'completed',
          result: result.data,
          completedAt: new Date().toISOString(),
        });
      }
    } else {
      updateJob({
        id: job.id,
        status: 'failed',
        error: result.error,
      });

      // Call webhook if provided
      if (job.callbackUrl) {
        await callWebhook(job.callbackUrl, {
          jobId: job.id,
          type: job.type,
          status: 'failed',
          error: result.error,
          completedAt: new Date().toISOString(),
        });
      }
    }

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    updateJob({
      id: job.id,
      status: 'failed',
      error: errorMessage,
    });

    return error(errorMessage);
  }
}

/**
 * Process a patch note job
 */
async function processProcessPatchNoteJob(
  job: Job<ProcessPatchNoteJobParams>
): Promise<Result<unknown>> {
  const { params } = job;

  // Update progress
  updateJob({ id: job.id, progress: 30 });

  const result = await processPatchNote(params as never);

  // Update progress
  updateJob({ id: job.id, progress: 90 });

  return result;
}

/**
 * Process a render video job
 */
async function processRenderVideoJob(
  job: Job<RenderVideoJobParams>
): Promise<Result<unknown>> {
  const { params } = job;

  // Update progress
  updateJob({ id: job.id, progress: 20 });

  const result = await renderVideo(params);

  if (!result.success) {
    return result;
  }

  // Start polling for video completion
  // Note: In a production system, this should be handled by a separate worker
  const renderId = result.data.renderId;
  
  updateJob({ id: job.id, progress: 50 });

  // Return immediately - video will complete asynchronously
  // The client can poll the patch note's video status separately
  return result;
}

/**
 * Process a generate video top changes job
 */
async function processGenerateVideoTopChangesJob(
  job: Job<GenerateVideoTopChangesJobParams>
): Promise<Result<unknown>> {
  const { params } = job;

  updateJob({ id: job.id, progress: 30 });

  try {
    const topChanges = await generateVideoTopChangesFromContent(
      params.content,
      params.repoName
    );

    updateJob({ id: job.id, progress: 90 });

    if (!topChanges || topChanges.length === 0) {
      return error('Failed to generate top changes');
    }

    return { success: true, data: { topChanges } };
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to generate top changes');
  }
}

/**
 * Call a webhook URL with job result
 */
async function callWebhook(url: string, payload: unknown): Promise<void> {
  try {
    console.log(`📞 Calling webhook: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // TODO: Add HMAC signature for security
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`❌ Webhook failed: ${response.status} ${response.statusText}`);
    } else {
      console.log(`✅ Webhook called successfully`);
    }
  } catch (err) {
    console.error('❌ Failed to call webhook:', err);
  }
}

/**
 * Start processing jobs from the queue
 * In production, this should be replaced with a proper job queue (BullMQ, etc.)
 */
export function startJobProcessor(): void {
  console.log('🚀 Job processor started');

  // TODO: Implement proper job queue with:
  // - Worker threads
  // - Retry logic
  // - Concurrency control
  // - Persistent storage
}
