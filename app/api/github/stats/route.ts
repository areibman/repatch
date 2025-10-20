import { NextRequest, NextResponse } from 'next/server';
import { getRepoStats, HistoryFilters, TimePreset } from '@/lib/github';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const branch = searchParams.get('branch');
    const preset = searchParams.get('preset') as TimePreset | null;
    const since = searchParams.get('since');
    const until = searchParams.get('until');
    const baseRelease = searchParams.get('baseRelease');
    const headRelease = searchParams.get('headRelease');
    const includeTagsParam = searchParams.get('includeTags');
    const excludeTagsParam = searchParams.get('excludeTags');

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const filters: HistoryFilters = {};

    const includeTags = includeTagsParam
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const excludeTags = excludeTagsParam
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (includeTags?.length) {
      filters.includeTags = includeTags;
    }
    if (excludeTags?.length) {
      filters.excludeTags = excludeTags;
    }

    if ((since || until) && (baseRelease || headRelease)) {
      return NextResponse.json(
        { error: 'Cannot combine custom date ranges with release comparisons.' },
        { status: 400 }
      );
    }

    if (baseRelease || headRelease) {
      if (!baseRelease || !headRelease) {
        return NextResponse.json(
          { error: 'Both baseRelease and headRelease are required.' },
          { status: 400 }
        );
      }

      if (baseRelease === headRelease) {
        return NextResponse.json(
          { error: 'Select two different releases to compare.' },
          { status: 400 }
        );
      }

      filters.releaseRange = { base: baseRelease, head: headRelease };
    } else if (since || until) {
      if (!since || !until) {
        return NextResponse.json(
          { error: 'Both since and until dates are required for custom range.' },
          { status: 400 }
        );
      }

      const sinceDate = new Date(since);
      const untilDate = new Date(until);

      if (Number.isNaN(sinceDate.getTime()) || Number.isNaN(untilDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid custom range dates provided.' },
          { status: 400 }
        );
      }

      if (sinceDate > untilDate) {
        return NextResponse.json(
          { error: 'Custom range start date must be before the end date.' },
          { status: 400 }
        );
      }

      filters.customRange = {
        since: sinceDate.toISOString(),
        until: untilDate.toISOString(),
      };
    } else if (preset) {
      filters.preset = preset;
    } else {
      filters.preset = '1week';
    }

    const stats = await getRepoStats(owner, repo, filters, branch || undefined);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching repo stats:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch repo stats' },
      { status: 500 }
    );
  }
}

