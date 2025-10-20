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

    const url = `https://api.github.com/repos/${owner}/${repo}/labels?per_page=100`;
    const response = await fetch(url, {
      headers: getGitHubHeaders(),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to fetch labels';
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;
      }
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const labels = await response.json();

    return NextResponse.json(
      labels.map((label: any) => ({
        name: label.name,
        color: label.color,
        description: label.description ?? null,
      }))
    );
  } catch (error) {
    console.error('Error fetching labels:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch labels' },
      { status: 500 }
    );
  }
}
