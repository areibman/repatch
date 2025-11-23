import { NextRequest, NextResponse } from 'next/server';
import { getStats } from '@/lib/api/github';
import type { PatchNoteFilters } from '@/types/patch-note';

type Params = { params: Promise<{ owner: string; repo: string }> };

export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: Params) {
  const { owner, repo } = await params;
  const body = await request.json();

  const result = await getStats(owner, repo, {
    branch: body.branch,
    filters: body.filters as PatchNoteFilters | undefined,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result.data);
}
