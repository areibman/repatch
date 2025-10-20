import { NextRequest, NextResponse } from 'next/server';
import { fetchGitHubReleases } from '@/lib/github';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const releases = await fetchGitHubReleases(owner, repo);

    const response = releases.map((release) => ({
      id: release.id,
      tag_name: release.tag_name,
      name: release.name,
      published_at: release.published_at,
      draft: release.draft,
      prerelease: release.prerelease,
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching releases:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch releases' },
      { status: 500 }
    );
  }
}
