import { NextRequest, NextResponse } from 'next/server';
import { fetchGitHubBranches } from '@/lib/github';
import { withApiAuth } from '@/lib/api/with-auth';

export async function GET(request: NextRequest) {
  return withApiAuth(async () => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const owner = searchParams.get('owner');
      const repo = searchParams.get('repo');

      if (!owner || !repo) {
        return NextResponse.json(
          { error: 'Missing owner or repo parameter' },
          { status: 400 }
        );
      }

      const branches = await fetchGitHubBranches(owner, repo);

      return NextResponse.json(branches);
    } catch (error) {
      console.error('Error fetching branches:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch branches' },
        { status: 500 }
      );
    }
  });
}

