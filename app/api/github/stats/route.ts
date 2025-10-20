import { NextRequest, NextResponse } from 'next/server';
import { getRepoStats } from '@/lib/github';
import { getFilterSummaryLabel, validateFilterMetadata } from '@/lib/filter-metadata';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, branch, filters } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required repository parameters' },
        { status: 400 }
      );
    }

    const validation = validateFilterMetadata(filters);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }

    const stats = await getRepoStats(owner, repo, validation.normalized, branch ?? null);
    const filterLabel = getFilterSummaryLabel(validation.normalized);

    return NextResponse.json({
      ...stats,
      filterLabel,
      appliedFilters: validation.normalized,
    });
  } catch (error) {
    console.error('Error fetching repo stats:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch repo stats' },
      { status: 500 }
    );
  }
}

