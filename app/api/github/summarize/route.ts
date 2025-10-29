/**
 * GitHub Summarize API Route
 * Thin HTTP adapter for the GitHub summarization service
 * No business logic - just validation and HTTP concerns
 */

import { NextRequest, NextResponse } from 'next/server';
import { summarizeCommits, validateSummarizeInput } from '@/lib/services';
import { cookies } from 'next/headers';

export const maxDuration = 120; // 2 minutes

export async function POST(request: NextRequest) {
  const body = await request.json();
  const cookieStore = await cookies();
  
  const validationResult = validateSummarizeInput(body, cookieStore);
  
  if (!validationResult.success) {
    return NextResponse.json(
      { error: validationResult.error },
      { status: 400 }
    );
  }

  const result = await summarizeCommits(validationResult.data);

  return result.success
    ? NextResponse.json(result.data)
    : NextResponse.json({ error: result.error }, { status: 500 });
}

