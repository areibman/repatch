import { NextRequest, NextResponse } from 'next/server';
import { fetchGitHubReleases } from '@/lib/github';
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

      const releases = await fetchGitHubReleases(owner, repo);
      return NextResponse.json(releases);
    } catch (error) {
      console.error('Error fetching releases:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch releases' },
        { status: 500 }
      );
    }
  });
}
