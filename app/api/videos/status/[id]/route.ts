import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const isMock = process.env.REPATCH_TEST_MODE === 'mock';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (isMock) {
      const { getPatchNoteById } = await import('@/lib/testing/mockStore');
      const note = getPatchNoteById(id);
      if (!note) {
        return NextResponse.json({ error: 'Patch note not found' }, { status: 404 });
      }
      return NextResponse.json({
        hasVideo: !!note.video_url,
        videoUrl: note.video_url,
        mode: 'mock',
      });
    }

    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('patch_notes')
      .select('video_url')
      .eq('id', id)
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      hasVideo: !!data.video_url,
      videoUrl: data.video_url 
    });
  } catch (error) {
    console.error('Error checking video status:', error);
    return NextResponse.json(
      { error: 'Failed to check video status' },
      { status: 500 }
    );
  }
}

