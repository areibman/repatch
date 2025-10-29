/**
 * GitHub Stats API Route
 * Thin HTTP adapter for the GitHub stats service
 * No business logic - just validation and HTTP concerns
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchGitHubStats, validateGitHubStatsInput } from '@/lib/services';
import type { PatchNoteFilters, TimePreset } from '@/types/patch-note';

export const maxDuration = 60; // 1 minute

/**
 * Build filters from query parameters (functional, no mutations)
 */
function buildFiltersFromQuery(
  since: string | null,
  until: string | null,
  preset: TimePreset | null
): PatchNoteFilters | undefined {
  if (since && until) {
    return {
      mode: 'custom' as const,
      customRange: { since, until },
    };
  }
  
  if (preset) {
    return {
      mode: 'preset' as const,
      preset,
    };
  }
  
  return undefined;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const branch = searchParams.get('branch');
  const preset = searchParams.get('timePeriod') as TimePreset | null;
  const since = searchParams.get('since');
  const until = searchParams.get('until');

  if (!owner || !repo) {
    return NextResponse.json(
      { error: 'Missing required parameters: owner and repo' },
      { status: 400 }
    );
  }

  const filters = buildFiltersFromQuery(since, until, preset);

  const result = await fetchGitHubStats({
    owner,
    repo,
    branch: branch ?? undefined,
    filters,
  });

  return result.success
    ? NextResponse.json(result.data)
    : NextResponse.json({ error: result.error }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const validationResult = validateGitHubStatsInput(body);
  
  if (!validationResult.success) {
    return NextResponse.json(
      { error: validationResult.error },
      { status: 400 }
    );
  }

  const result = await fetchGitHubStats(validationResult.data);

  return result.success
    ? NextResponse.json(result.data)
    : NextResponse.json({ error: result.error }, { status: 500 });
}

