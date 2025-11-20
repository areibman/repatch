/**
 * Individual Job API Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJob, deleteJob } from '@/lib/api-core';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/jobs/[id] - Get job status
 */
export async function GET(
  request: NextRequest,
  { params }: Params
) {
  const { id } = await params;
  const result = getJob(id);

  return result.success
    ? NextResponse.json(result.data)
    : NextResponse.json({ error: result.error }, { status: 404 });
}

/**
 * DELETE /api/v1/jobs/[id] - Cancel a job
 */
export async function DELETE(
  request: NextRequest,
  { params }: Params
) {
  const { id } = await params;
  const result = deleteJob(id);

  return result.success
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: result.error }, { status: 400 });
}
