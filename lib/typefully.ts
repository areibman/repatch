interface CreateDraftOptions {
  tweets: string[];
  title?: string;
}

function sanitizeTweets(tweets: string[]): string[] {
  return tweets
    .map((tweet) => tweet.replace(/(^|\s)#(\w+)/g, '$1$2').trim())
    .filter((tweet) => tweet.length > 0)
    .map((tweet) => {
      if (tweet.length <= 275) {
        return tweet;
      }

      let truncated = tweet.slice(0, 275);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 200) {
        truncated = truncated.slice(0, lastSpace);
      }

      return truncated.trim();
    });
}

export async function createTypefullyDraft({
  tweets,
  title,
}: CreateDraftOptions) {
  const apiKey = process.env.TYPEFULLY_API_KEY;

  if (!apiKey) {
    throw new Error('TYPEFULLY_API_KEY is not configured.');
  }

  const profileId = process.env.TYPEFULLY_PROFILE_ID;
  const sanitizedTweets = sanitizeTweets(tweets);

  if (sanitizedTweets.length === 0) {
    throw new Error('At least one tweet is required to create a draft.');
  }

  const attempts: Record<string, unknown>[] = [
    {
      content: sanitizedTweets.map((text) => ({ text })),
      status: 'draft',
      platform: 'twitter',
      ...(title ? { title } : {}),
      ...(profileId ? { profileId } : {}),
    },
    {
      draft: {
        content: sanitizedTweets.map((text) => ({ text })),
        status: 'draft',
        platform: 'twitter',
        ...(title ? { title } : {}),
        ...(profileId ? { profileId } : {}),
      },
    },
    {
      draft: {
        posts: sanitizedTweets.map((text) => ({ body: text })),
        status: 'draft',
        platform: 'twitter',
        ...(title ? { title } : {}),
        ...(profileId ? { profileId } : {}),
      },
    },
  ];

  let lastError: string | null = null;

  for (const payload of attempts) {
    const response = await fetch('https://api.typefully.com/v1/drafts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return response.json();
    }

    lastError = await response.text();
  }

  throw new Error(
    `Typefully API error: ${lastError || 'Unable to create draft with available payload shapes.'}`
  );
}
