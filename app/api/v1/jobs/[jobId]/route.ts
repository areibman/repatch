import { NextRequest, NextResponse } from 'next/server';
import { getJob, cancelJob } from '@/lib/api/jobs';

type Params = { params: Promise<{ jobId: string }> };

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { jobId } = await params;

    const job = await getJob(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch job' },
      { status: 500 }
    );
  }
}
