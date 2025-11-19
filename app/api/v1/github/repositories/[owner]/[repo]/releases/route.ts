import { NextRequest, NextResponse } from 'next/server';
import { listReleases } from '@/lib/api/github';

type Params = { params: Promise<{ owner: string; repo: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { owner, repo } = await params;

  const result = await listReleases(owner, repo);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result.data);
}
