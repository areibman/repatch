const TYPEFULLY_API_BASE_URL = process.env.TYPEFULLY_API_BASE_URL || 'https://api.typefully.com/v1';

interface CreateDraftOptions {
  thread: string[];
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface TypefullyDraftResponse {
  id?: string;
  url?: string;
  share_url?: string;
  [key: string]: unknown;
}

export async function createTypefullyDraft(
  options: CreateDraftOptions
): Promise<TypefullyDraftResponse> {
  const apiKey = process.env.TYPEFULLY_API_KEY;

  if (!apiKey) {
    throw new Error('TYPEFULLY_API_KEY is not configured');
  }

  const { thread, title, metadata } = options;

  const payload: Record<string, unknown> = {
    title,
    body: thread.join('\n\n'),
    tweets: thread.map((body, index) => ({ body, index })),
  };

  if (metadata) {
    payload.metadata = metadata;
  }

  const response = await fetch(`${TYPEFULLY_API_BASE_URL}/drafts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': 'repatch/1.0',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Typefully API request failed (${response.status} ${response.statusText}): ${errorBody}`
    );
  }

  try {
    return (await response.json()) as TypefullyDraftResponse;
  } catch {
    return {};
  }
}
