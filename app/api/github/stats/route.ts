import { NextRequest, NextResponse } from 'next/server';
import { getRepoStats } from '@/lib/github';
import { FilterValidationError } from '@/lib/filter-utils';
import { PatchNoteFilters, TimePreset } from '@/types/patch-note';

// Configure maximum duration for this route (GitHub API calls can be slow)
export const maxDuration = 60; // 1 minute

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const branch = searchParams.get('branch');
    const preset = searchParams.get('timePeriod') as TimePreset | null;
    const since = searchParams.get('since');
    const until = searchParams.get('until');

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    let filters: PatchNoteFilters | undefined;
    if (since && until) {
      filters = {
        mode: 'custom',
        customRange: { since, until },
      };
    } else if (preset) {
      filters = {
        mode: 'preset',
        preset,
      };
    }

    const stats = await getRepoStats(owner, repo, filters, branch || undefined);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching repo stats:', error);
    if (error instanceof FilterValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch repo stats' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, branch, filters } = body as {
      owner?: string;
      repo?: string;
      branch?: string;
      filters?: PatchNoteFilters;
    };

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const stats = await getRepoStats(owner, repo, filters, branch);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching repo stats:', error);
    if (error instanceof FilterValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch repo stats' },
      { status: 500 }
    );
  }
}

