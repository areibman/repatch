import { NextRequest, NextResponse } from 'next/server';
import { generateVideoTopChangesFromContent } from '@/lib/ai-summarizer';

export async function POST(request: NextRequest) {
  try {
    const { content, repoName } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    console.log('🎬 Generating video top 3 from content...');
    console.log('   - Content length:', content.length);
    console.log('   - Repo name:', repoName);

    const topChanges = await generateVideoTopChangesFromContent(
      content,
      repoName || 'repository'
    );

    if (topChanges.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate top changes' },
        { status: 500 }
      );
    }

    console.log('✅ Generated', topChanges.length, 'video top changes');

    return NextResponse.json({ topChanges });
  } catch (error) {
    console.error('Error generating video top 3:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate video top 3',
      },
      { status: 500 }
    );
  }
}

