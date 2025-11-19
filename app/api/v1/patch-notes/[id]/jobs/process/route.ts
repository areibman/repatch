import { NextRequest, NextResponse } from 'next/server';
import { startProcessJob } from '@/lib/api/patch-notes';
import { cookies } from 'next/headers';
import type { PatchNoteFilters } from '@/types/patch-note';

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 300;

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const cookieStore = await cookies();

  if (!body.owner || !body.repo || !body.repoUrl || !body.filters) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const result = await startProcessJob({
    patchNoteId: id,
    owner: body.owner,
    repo: body.repo,
    repoUrl: body.repoUrl,
    branch: body.branch,
    filters: body.filters as PatchNoteFilters,
    templateId: body.templateId,
    cookieStore,
  });

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
