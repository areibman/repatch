const TYPEFULLY_API_BASE = 'https://api.typefully.com/v1';

interface CreateDraftOptions {
  title?: string | null;
  publishAt?: string | null;
}

interface TypefullyDraftPayload {
  thread: Array<{ text: string }>;
  status: 'draft';
  title?: string;
  platform: 'twitter';
  scheduled_at?: string;
}

export async function createTypefullyDraft(
  thread: string[],
  options: CreateDraftOptions = {}
) {
  const apiKey = process.env.TYPEFULLY_API_KEY;

  if (!apiKey) {
    throw new Error('TYPEFULLY_API_KEY environment variable is not set');
  }

  if (!thread.length) {
    throw new Error('Thread must contain at least one tweet');
  }

  const payload: TypefullyDraftPayload = {
    platform: 'twitter',
    status: 'draft',
    thread: thread.map((text) => ({ text })),
  };

  if (options.title) {
    payload.title = options.title;
  }

  if (options.publishAt) {
    payload.scheduled_at = options.publishAt;
  }

  const response = await fetch(`${TYPEFULLY_API_BASE}/drafts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Typefully API error ${response.status}: ${errorText || 'Unknown error'}`);
  }

  return response.json();
}
