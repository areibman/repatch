/**
 * SSE Endpoint for Video Render Status
 * Provides real-time status updates via Server-Sent Events
 * Replaces polling with push-based updates
 */

import { NextRequest } from 'next/server';
import { checkVideoRenderStatus } from '@/lib/remotion-lambda-renderer';

// Configure maximum duration for SSE stream
export const maxDuration = 300; // 5 minutes

/**
 * GET /api/patch-notes/[id]/video-status-stream
 * Streams video render status updates via Server-Sent Events
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  console.log('📡 Starting SSE stream for patch note:', id);

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Helper to send SSE message
      const sendEvent = (event: string, data: unknown) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Helper to send status update
      const sendStatus = async () => {
        try {
          const status = await checkVideoRenderStatus(id);
          sendEvent('status', status);

          // If terminal state (completed or failed), close stream
          if (status.status === 'completed' || status.status === 'failed') {
            sendEvent('end', { message: 'Stream ended' });
            controller.close();
            return false;
          }

          return true;
        } catch (error) {
          console.error('❌ Error checking status:', error);
          sendEvent('error', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return false;
        }
      };

      // Send initial status
      await sendStatus();

      // Poll for updates every 2 seconds
      const interval = setInterval(async () => {
        const shouldContinue = await sendStatus();
        if (!shouldContinue) {
          clearInterval(interval);
        }
      }, 2000);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        console.log('📡 Client disconnected, closing stream');
        clearInterval(interval);
        controller.close();
      });

      // Set timeout to close stream after max duration
      setTimeout(() => {
        console.log('📡 Stream timeout, closing');
        clearInterval(interval);
        sendEvent('timeout', { message: 'Stream timeout' });
        controller.close();
      }, 290000); // 290 seconds (less than maxDuration)
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
