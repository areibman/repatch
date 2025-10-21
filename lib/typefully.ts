const TYPEFULLY_API_BASE = 'https://api.typefully.com/v1';

interface CreateDraftOptions {
  scheduleDate?: string | null;
  threadify?: boolean;
  share?: boolean;
  autoRetweetEnabled?: boolean;
  autoPlugEnabled?: boolean;
}

interface TypefullyDraftPayload {
  content: string;
  threadify?: boolean;
  share?: boolean;
  'schedule-date'?: string;
  auto_retweet_enabled?: boolean;
  auto_plug_enabled?: boolean;
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

  // Join tweets with 4 newlines as per Typefully API documentation
  const content = thread.join('\n\n\n\n');

  const payload: TypefullyDraftPayload = {
    content,
    threadify: options.threadify ?? false,
    share: options.share ?? false,
  };

  if (options.scheduleDate) {
    payload['schedule-date'] = options.scheduleDate;
  }

  if (options.autoRetweetEnabled !== undefined) {
    payload.auto_retweet_enabled = options.autoRetweetEnabled;
  }

  if (options.autoPlugEnabled !== undefined) {
    payload.auto_plug_enabled = options.autoPlugEnabled;
  }

  const response = await fetch(`${TYPEFULLY_API_BASE}/drafts/`, {
    method: 'POST',
    headers: {
      'X-API-KEY': `Bearer ${apiKey}`,
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

export async function scheduleTypefullyDraftNextSlot(
  thread: string[],
  options: Omit<CreateDraftOptions, 'scheduleDate'> = {}
) {
  // Schedule in the next available slot
  return createTypefullyDraft(thread, {
    ...options,
    scheduleDate: 'next-free-slot',
  });
}
