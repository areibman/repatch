import { NextRequest, NextResponse } from 'next/server';
import { fetchGitHubTags } from '@/lib/github';

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

    const tagMap = await fetchGitHubTags(owner, repo);
    const tags = Array.from(
      new Set(
        Object.values(tagMap)
          .flat()
          .filter((tag): tag is string => Boolean(tag))
      )
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json(tags);
  } catch (error) {
    console.error('Error fetching repository tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repository tags' },
      { status: 500 }
    );
  }
}
