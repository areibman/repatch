interface CreateTypefullyDraftOptions {
  title?: string;
}

export interface TypefullyDraftResult {
  id?: string;
  url?: string | null;
  raw: unknown;
}

export async function createTypefullyDraft(
  tweets: string[],
  options: CreateTypefullyDraftOptions = {}
): Promise<TypefullyDraftResult> {
  const apiKey = process.env.TYPEFULLY_API_KEY;

  if (!apiKey) {
    throw new Error('TYPEFULLY_API_KEY is not configured');
  }

  const payload = {
    title: options.title,
    content: tweets.map((body) => ({ body })),
    tweets: tweets.map((body) => ({ body })),
  };

  const response = await fetch('https://api.typefully.com/v1/drafts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Typefully API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const possibleUrl =
    (typeof data?.url === 'string' && data.url) ||
    (typeof data?.web_url === 'string' && data.web_url) ||
    (typeof data?.share_url === 'string' && data.share_url) ||
    null;

  return {
    id: typeof data?.id === 'string' ? data.id : undefined,
    url: possibleUrl,
    raw: data,
  };
}
