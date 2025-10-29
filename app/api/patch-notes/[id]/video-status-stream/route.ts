/**
 * Server-Sent Events (SSE) endpoint for real-time video render status updates
 * Eliminates need for polling by pushing updates to client as they occur
 */

import { NextRequest } from 'next/server';
import { getVideoRenderStatus } from '@/lib/remotion-lambda-renderer';

// Configure maximum duration for this route
// SSE connections can be long-lived
export const maxDuration = 300; // 5 minutes

/**
 * GET /api/patch-notes/[id]/video-status-stream
 * SSE endpoint that streams video render status updates
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
      let isClosed = false;

      // Helper to send SSE data
      const send = (data: string) => {
        if (!isClosed) {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
      };

      // Helper to send JSON data
      const sendJSON = (obj: unknown) => {
        send(JSON.stringify(obj));
      };

      // Poll interval (seconds)
      const POLL_INTERVAL = 3; // Check every 3 seconds
      let lastStatus: string | null = null;

      try {
        // Send initial connection message
        sendJSON({ type: 'connected', message: 'Connected to video status stream' });

        // Poll loop
        const pollLoop = async () => {
          if (isClosed) return;

          try {
            const status = await getVideoRenderStatus(id);

            // Only send update if status changed
            const statusKey = `${status.status}-${status.progress}-${status.videoUrl || ''}`;
            if (statusKey !== lastStatus) {
              lastStatus = statusKey;
              sendJSON({
                type: 'status',
                ...status,
              });

              // Close connection if terminal state reached
              if (status.status === 'completed' || status.status === 'failed') {
                sendJSON({ type: 'complete', message: 'Render finished' });
                setTimeout(() => {
                  isClosed = true;
                  controller.close();
                }, 1000);
                return;
              }
            }
          } catch (error) {
            console.error('Error polling video status:', error);
            sendJSON({
              type: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }

          // Schedule next poll
          if (!isClosed) {
            setTimeout(pollLoop, POLL_INTERVAL * 1000);
          }
        };

        // Start polling
        pollLoop();

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          isClosed = true;
          controller.close();
        });
      } catch (error) {
        console.error('SSE stream error:', error);
        sendJSON({
          type: 'error',
          error: error instanceof Error ? error.message : 'Stream error',
        });
        controller.close();
      }
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
