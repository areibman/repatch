import { NextRequest, NextResponse } from 'next/server';
import { getRepoStats } from '@/lib/github';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const timePeriod = searchParams.get('timePeriod') as '1day' | '1week' | '1month';
    const branch = searchParams.get('branch');

    if (!owner || !repo || !timePeriod) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const stats = await getRepoStats(owner, repo, timePeriod, branch || undefined);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching repo stats:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch repo stats' },
      { status: 500 }
    );
  }
}

