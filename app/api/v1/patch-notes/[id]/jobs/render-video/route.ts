import { NextRequest, NextResponse } from 'next/server';
import { startVideoRenderJob } from '@/lib/api/patch-notes';

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const result = await startVideoRenderJob(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(
    {
      jobId: result.data.id,
      status: result.data.status,
      pollUrl: `/api/v1/jobs/${result.data.id}`,
    },
    { status: 202 }
  );
}
