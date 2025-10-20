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

    return NextResponse.json(releases);
  } catch (error) {
    console.error('Error fetching repository releases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repository releases' },
      { status: 500 }
    );
  }
}
