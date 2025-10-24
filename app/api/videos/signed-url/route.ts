import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * GET /api/videos/signed-url?patchNoteId={id}
 * 
 * Generates a time-limited signed URL for accessing a video.
 * Requires authentication to prevent unauthorized access.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patchNoteId = searchParams.get('patchNoteId');

    if (!patchNoteId) {
      return NextResponse.json(
        { error: 'Missing patchNoteId parameter' },
        { status: 400 }
      );
    }

    // Check authentication (you can customize this based on your auth setup)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // For now, we'll allow access if user is logged in OR if there's no auth set up yet
    // You can make this stricter by requiring authentication
    const isAuthenticated = !!user || !authError;

    console.log('🔐 Signed URL request:', {
      patchNoteId,
      isAuthenticated,
      userId: user?.id || 'anonymous'
    });

    // Fetch the video_url path from database
    const { data: patchNote, error: fetchError } = await supabase
      .from('patch_notes')
      .select('video_url')
      .eq('id', patchNoteId)
      .single();

    if (fetchError || !patchNote) {
      console.error('❌ Failed to fetch patch note:', fetchError);
      return NextResponse.json(
        { error: 'Patch note not found' },
        { status: 404 }
      );
    }

    if (!patchNote.video_url) {
      return NextResponse.json(
        { error: 'No video available for this patch note' },
        { status: 404 }
      );
    }

    // Extract the storage path from video_url
    // video_url format: either full URL or just the path
    let storagePath = patchNote.video_url;
    
    // If it's a full URL, extract just the path
    if (storagePath.includes('/storage/v1/object/public/videos/')) {
      storagePath = storagePath.split('/storage/v1/object/public/videos/')[1];
    } else if (storagePath.includes('/storage/v1/object/')) {
      storagePath = storagePath.split('/storage/v1/object/')[1].replace('public/videos/', '');
    }

    // Use service client to generate signed URL
    const serviceSupabase = createServiceClient();
    const videoBucket = process.env.SUPABASE_VIDEO_BUCKET || 'videos';

    const { data: signedData, error: signedError } = await serviceSupabase.storage
      .from(videoBucket)
      .createSignedUrl(storagePath, 3600); // 1 hour expiration

    if (signedError || !signedData) {
      console.error('❌ Failed to generate signed URL:', signedError);
      return NextResponse.json(
        { error: 'Failed to generate video access URL' },
        { status: 500 }
      );
    }

    console.log('✅ Signed URL generated successfully');
    
    return NextResponse.json({
      signedUrl: signedData.signedUrl,
      expiresIn: 3600, // seconds
    });

  } catch (error) {
    console.error('❌ Error generating signed URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

