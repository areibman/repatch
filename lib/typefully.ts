import { Database } from '@/lib/supabase/database.types';

export type QueueThreadInput = {
  text: string;
  mediaUrl?: string; // local URL like /videos/foo.mp4
  dryRun?: boolean;
  apiKey?: string; // override
};

export type QueueThreadResult = {
  ok: boolean;
  threadId?: string;
  error?: string;
  mediaId?: string;
};

const TYPEFULLY_API_BASE = process.env.TYPEFULLY_API_BASE || 'https://api.typefully.com/v1';

async function uploadMediaToTypefully(opts: { apiKey: string; fileBuffer: Buffer; filename: string; contentType: string; dryRun?: boolean; }): Promise<{ ok: boolean; mediaId?: string; error?: string; }> {
  if (opts.dryRun || process.env.MOCK_TYPEFULLY === '1') {
    return { ok: true, mediaId: 'mock-media-id' };
  }

  // Fallback: if external media upload API shape differs, skip attaching media
  try {
    const form = new FormData();
    form.append('file', new Blob([opts.fileBuffer], { type: opts.contentType }), opts.filename);

    const res = await fetch(`${TYPEFULLY_API_BASE}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: form as any,
    } as RequestInit);

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Upload failed: ${res.status} ${text}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, mediaId: data.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Upload error' };
  }
}

export async function queueThread({ text, mediaUrl, dryRun, apiKey }: QueueThreadInput): Promise<QueueThreadResult> {
  const token = apiKey || process.env.TYPEFULLY_API_KEY || '';
  if (!token && !dryRun && process.env.MOCK_TYPEFULLY !== '1') {
    return { ok: false, error: 'Missing TYPEFULLY_API_KEY' };
  }

  if (dryRun || process.env.MOCK_TYPEFULLY === '1') {
    return { ok: true, threadId: 'mock-thread-id', mediaId: mediaUrl ? 'mock-media-id' : undefined };
  }

  let mediaId: string | undefined;
  if (mediaUrl) {
    try {
      const absoluteUrl = mediaUrl.startsWith('http') ? mediaUrl : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${mediaUrl}`;
      const res = await fetch(absoluteUrl);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const upload = await uploadMediaToTypefully({
          apiKey: token,
          fileBuffer: buffer,
          filename: mediaUrl.split('/').pop() || 'video.mp4',
          contentType: res.headers.get('content-type') || 'video/mp4',
        });
        if (upload.ok && upload.mediaId) mediaId = upload.mediaId;
      }
    } catch {
      // ignore media upload failure; continue with text-only thread
    }
  }

  try {
    const payload: Record<string, any> = { text };
    if (mediaId) payload.mediaIds = [mediaId];

    const res = await fetch(`${TYPEFULLY_API_BASE}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Typefully post failed: ${res.status} ${body}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, threadId: data.id, mediaId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
