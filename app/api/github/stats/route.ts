import { NextRequest, NextResponse } from 'next/server';
import { getRepoStats } from '@/lib/github';
import type { PatchNoteFilters, TimePreset } from '@/types/patch-note';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const branch = searchParams.get('branch') || undefined;
    const timePeriod = searchParams.get('timePeriod') as TimePreset | null;
    const since = searchParams.get('since');
    const until = searchParams.get('until');
    const releaseTag = searchParams.get('releaseTag') || undefined;
    const includeTags = searchParams.get('includeTags');
    const excludeTags = searchParams.get('excludeTags');

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    if (releaseTag && (since || until)) {
      return NextResponse.json(
        { error: 'Select either a release or a custom date range, not both.' },
        { status: 400 }
      );
    }

    if ((since && !until) || (!since && until)) {
      return NextResponse.json(
        { error: 'Custom ranges require both start and end timestamps.' },
        { status: 400 }
      );
    }

    const filters: PatchNoteFilters = {};

    if (releaseTag) {
      filters.releaseTag = releaseTag;
    } else if (since && until) {
      filters.customRange = { since, until };
    } else if (timePeriod) {
      filters.preset = timePeriod;
    }

    if (includeTags) {
      filters.includeTags = includeTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    if (excludeTags) {
      filters.excludeTags = excludeTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    const stats = await getRepoStats(owner, repo, {
      branch,
      filters,
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching repo stats:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch repo stats' },
      { status: 500 }
    );
  }
}
