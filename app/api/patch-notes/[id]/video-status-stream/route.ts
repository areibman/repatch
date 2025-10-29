/**
 * SSE Endpoint for Video Render Status
 * Provides real-time status updates via Server-Sent Events
 * Eliminates the need for polling
 */

import { NextRequest } from 'next/server';
import {
  getVideoRenderState,
  clearStateCache,
  transitionVideoRenderState,
  updateVideoRenderProgress,
} from '@/lib/services/video-render-state-manager';
import { getRenderProgress, AwsRegion } from '@remotion/lambda/client';
import { createServiceSupabaseClient } from '@/lib/supabase';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const REMOTION_APP_FUNCTION_NAME =
  process.env.REMOTION_APP_FUNCTION_NAME ||
  'remotion-render-4-0-355-mem2048mb-disk2048mb-300sec';

export const maxDuration = 300; // 5 minutes for SSE stream

/**
 * GET /api/patch-notes/[id]/video-status-stream
 * Streams video render status updates via Server-Sent Events
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Helper to send SSE data
      const send = (data: Record<string, unknown>) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial connection message
      send({ type: 'connected', patchNoteId: id });

      let isActive = true;
      let checkCount = 0;
      const MAX_CHECKS = 600; // 5 minutes at 0.5s intervals
      const CHECK_INTERVAL_MS = 500;

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        isActive = false;
        controller.close();
      });

      try {
        while (isActive && checkCount < MAX_CHECKS) {
          // Get current state
          const currentState = await getVideoRenderState(id, true); // Bypass cache for real-time

          // If completed or failed, send final status and close
          if (
            currentState.state === 'completed' ||
            currentState.state === 'failed'
          ) {
            send({
              type: 'status',
              status: currentState.state,
              progress: currentState.progress ?? 100,
              videoUrl: currentState.videoUrl,
              error: currentState.error,
            });
            controller.close();
            return;
          }

          // If we have a render ID, check Lambda progress
          if (currentState.renderId && currentState.bucketName) {
            try {
              const supabase = createServiceSupabaseClient();
              const { data: patchNote } = await supabase
                .from('patch_notes')
                .select('video_render_id, video_bucket_name')
                .eq('id', id)
                .single();

              if (patchNote?.video_render_id && patchNote?.video_bucket_name) {
                const progress = await getRenderProgress({
                  region: AWS_REGION as AwsRegion,
                  functionName: REMOTION_APP_FUNCTION_NAME,
                  bucketName: patchNote.video_bucket_name,
                  renderId: patchNote.video_render_id,
                });

                const progressPercent = Math.round(
                  (progress.overallProgress || 0) * 100
                );

                // Update progress in database
                await updateVideoRenderProgress(
                  id,
                  progressPercent,
                  `Rendering video... ${progressPercent}%`
                );

                // Check for fatal errors
                if (progress.fatalErrorEncountered) {
                  const errorMsg =
                    progress.errors?.[0]?.message || 'Unknown render error';
                  await transitionVideoRenderState(id, 'failed', {
                    processing_error: `Video render failed: ${errorMsg}`,
                    video_render_id: null,
                    video_bucket_name: null,
                  });

                  send({
                    type: 'status',
                    status: 'failed',
                    progress: progressPercent,
                    error: errorMsg,
                  });
                  controller.close();
                  return;
                }

                // Check if completed
                if (progress.done && progress.outputFile) {
                  const videoUrl = progress.outputFile.startsWith('http://') ||
                    progress.outputFile.startsWith('https://')
                    ? progress.outputFile
                    : `https://${patchNote.video_bucket_name}.s3.${AWS_REGION}.amazonaws.com/${progress.outputFile}`;

                  await transitionVideoRenderState(id, 'completed', {
                    video_url: videoUrl,
                    video_render_id: null,
                    video_bucket_name: null,
                    processing_progress: 100,
                  });

                  send({
                    type: 'status',
                    status: 'completed',
                    progress: 100,
                    videoUrl,
                  });
                  controller.close();
                  return;
                }

                // Still rendering - send progress update
                // Use 'rendering' status for UI (DB stores 'generating_video')
                send({
                  type: 'status',
                  status: progressPercent > 0 && progressPercent < 100 ? 'rendering' : 'generating_video',
                  progress: progressPercent,
                });
              }
            } catch (lambdaError) {
              console.error('❌ Error checking Lambda progress:', lambdaError);
              // Continue polling even if Lambda check fails
            }
          } else {
            // No render ID yet - still in generating_video state
            send({
              type: 'status',
              status: currentState.state ?? 'pending',
              progress: currentState.progress ?? 0,
            });
          }

          checkCount++;
          await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL_MS));
        }

        // Timeout - send final status
        const finalState = await getVideoRenderState(id, true);
        send({
          type: 'status',
          status: finalState.state ?? 'pending',
          progress: finalState.progress ?? 0,
          error: 'Stream timeout - check status manually',
        });
        controller.close();
      } catch (error) {
        console.error('❌ SSE stream error:', error);
        send({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
