/**
 * Video Render Service
 * Pure functions for video rendering orchestration
 */

import { startVideoRender } from '@/lib/remotion-lambda-renderer';
import type { ServiceResult } from './github-stats.service';

/**
 * Input for video rendering
 */
export interface RenderVideoInput {
  readonly patchNoteId: string;
}

/**
 * Result of video render initiation
 */
export interface RenderVideoResult {
  readonly renderId: string;
  readonly bucketName: string;
}

/**
 * Start video rendering for a patch note
 * Pure function that wraps the Lambda render service
 */
export async function renderVideo(
  input: RenderVideoInput
): Promise<ServiceResult<RenderVideoResult>> {
  try {
    console.log('🎬 Triggering video render for patch note:', input.patchNoteId);

    const result = await startVideoRender(input.patchNoteId);

    console.log('✅ Video render job initiated:', result);

    return {
      success: true,
      data: {
        renderId: result.renderId,
        bucketName: result.bucketName,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : 'Failed to start video render';

    console.error('❌ Error starting video render:', errorMessage);

    return { success: false, error: errorMessage };
  }
}

