/**
 * Unified GitHub Metadata API Route
 * GET /api/v1/github/metadata
 * 
 * Fetches multiple types of GitHub repository metadata in a single request
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGitHubMetadata } from '@/lib/api-core';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const includeParam = searchParams.get('include');

  // Validate required parameters
  if (!owner || !repo) {
    return NextResponse.json(
      { error: 'Missing required parameters: owner and repo' },
      { status: 400 }
    );
  }

  // Parse include parameter (comma-separated list)
  const include = includeParam
    ? includeParam.split(',').map(s => s.trim()) as ('branches' | 'labels' | 'releases' | 'tags')[]
    : undefined;

  // Call core API
  const result = await getGitHubMetadata({ owner, repo, include });

  // Return result
  return result.success
    ? NextResponse.json(result.data)
    : NextResponse.json({ error: result.error }, { status: 500 });
}
