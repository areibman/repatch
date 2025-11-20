import { NextRequest, NextResponse } from 'next/server';
import { cancelJob } from '@/lib/api/jobs';

type Params = { params: Promise<{ jobId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { jobId } = await params;

    const job = await cancelJob(jobId);

    return NextResponse.json(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel job';
    const status = message.includes('not found') ? 404 : message.includes('cannot be cancelled') ? 409 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
