/**
 * Jobs API Routes
 * Async job management
 */

import { NextRequest, NextResponse } from 'next/server';
import { createJob, listJobs, processJob } from '@/lib/api-core';
import type { CreateJobInput, JobStatus, JobType } from '@/lib/api-core';

/**
 * GET /api/v1/jobs - List all jobs
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') as JobType | null;
  const status = searchParams.get('status') as JobStatus | null;

  const filters: { type?: string; status?: JobStatus } = {};
  if (type) filters.type = type;
  if (status) filters.status = status;

  const result = listJobs(filters);

  return result.success
    ? NextResponse.json(result.data)
    : NextResponse.json({ error: result.error }, { status: 500 });
}

/**
 * POST /api/v1/jobs - Create a new job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    if (!body.type) {
      return NextResponse.json(
        { error: 'Missing required field: type' },
        { status: 400 }
      );
    }

    if (!body.params) {
      return NextResponse.json(
        { error: 'Missing required field: params' },
        { status: 400 }
      );
    }

    const input: CreateJobInput = {
      type: body.type,
      params: body.params,
      callbackUrl: body.callbackUrl,
    };

    // Create the job
    const result = createJob(input);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const job = result.data;

    // Process the job asynchronously (fire and forget)
    // In production, this should be handled by a job queue worker
    processJob(job)
      .then((processResult) => {
        if (processResult.success) {
          console.log(`✅ Job ${job.id} completed successfully`);
        } else {
          console.error(`❌ Job ${job.id} failed:`, processResult.error);
        }
      })
      .catch((error) => {
        console.error(`❌ Job ${job.id} processing error:`, error);
      });

    // Return the created job immediately
    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}
