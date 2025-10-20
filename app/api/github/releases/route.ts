import { NextRequest, NextResponse } from 'next/server';
import { getGitHubHeaders } from '@/lib/github';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required repository parameters' },
        { status: 400 }
      );
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`;
    const response = await fetch(url, {
      headers: getGitHubHeaders(),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to fetch releases';
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;
      }
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const releases = await response.json();

    return NextResponse.json(
      releases.map((release: any) => ({
        id: release.id,
        name: release.name || release.tag_name,
        tag: release.tag_name,
        draft: release.draft,
        prerelease: release.prerelease,
        publishedAt: release.published_at,
      }))
    );
  } catch (error) {
    console.error('Error fetching releases:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch releases' },
      { status: 500 }
    );
  }
}
