import { createClient } from "@/lib/supabase/server";

export type TypefullyConfig = {
  apiKey: string;
  profileId: string;
  teamId?: string | null;
};

export async function getTypefullyConfig(): Promise<TypefullyConfig | null> {
  const envApiKey = process.env.TYPEFULLY_API_KEY;
  const envProfileId = process.env.TYPEFULLY_PROFILE_ID;
  const envTeamId = process.env.TYPEFULLY_TEAM_ID || null;

  // Prefer DB, fallback to env
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("typefully_configs")
      .select("api_key, profile_id, team_id")
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        apiKey: data.api_key as string,
        profileId: data.profile_id as string,
        teamId: (data.team_id as string | null) ?? null,
      };
    }
  } catch {
    // ignore
  }

  if (envApiKey && envProfileId) {
    return { apiKey: envApiKey, profileId: envProfileId, teamId: envTeamId };
  }

  return null;
}

export function splitIntoTweets(text: string, maxLen = 280): string[] {
  const chunks: string[] = [];
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const para of paragraphs) {
    if (para.length <= maxLen) {
      chunks.push(para);
      continue;
    }
    let remaining = para;
    while (remaining.length > maxLen) {
      // Try split at last period or space before maxLen
      let splitAt = remaining.lastIndexOf(". ", maxLen);
      if (splitAt === -1) splitAt = remaining.lastIndexOf(" ", maxLen);
      if (splitAt === -1 || splitAt < maxLen * 0.5) splitAt = maxLen;
      chunks.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    }
    if (remaining) chunks.push(remaining);
  }

  return chunks.slice(0, 12); // keep thread reasonable
}

export type ComposeThreadInput = {
  title: string;
  repoName: string;
  repoUrl: string;
  content: string;
  changes: { added: number; modified: number; removed: number };
  contributors: string[];
  patchNoteId: string;
  baseUrl: string;
  videoUrl?: string | null;
};

export function composeThread(input: ComposeThreadInput): string[] {
  const lines: string[] = [];
  const link = `${input.baseUrl}/blog/${input.patchNoteId}`;
  const header = `${input.title} – ${input.repoName}`;
  lines.push(`${header}\n\n${link}`);

  const stats = `+${input.changes.added} / -${input.changes.removed} • ${
    input.contributors.length
  } contributor${input.contributors.length !== 1 ? "s" : ""}`;
  lines.push(stats);

  // Use the first few headings or bullet points from content
  const contentBullets = input.content
    .split(/\n/)
    .filter((l) => l.trim().startsWith("-") || l.trim().startsWith("*"))
    .slice(0, 6)
    .map((b) => b.replace(/^[-*]\s*/, "").trim());

  if (contentBullets.length === 0) {
    const paragraphs = input.content.split(/\n{2,}/).slice(0, 3);
    for (const p of paragraphs) lines.push(p.trim());
  } else {
    for (const b of contentBullets) lines.push(`• ${b}`);
  }

  if (input.videoUrl) {
    lines.push(`📹 Watch the video: ${input.baseUrl}${input.videoUrl}`);
  }

  // Split long lines into tweets
  const tweets = lines.flatMap((l) => splitIntoTweets(l));

  // Ensure first tweet includes header and link
  if (!tweets[0]?.includes(link)) {
    tweets[0] = `${header}\n\n${link}`;
  }

  return tweets;
}

export type QueueThreadParams = {
  config: TypefullyConfig;
  posts: string[];
};

export async function queueThread({ config, posts }: QueueThreadParams): Promise<{
  ok: boolean;
  threadId?: string;
  error?: string;
  response?: any;
}> {
  if (process.env.TYPEFULLY_MOCK === "1") {
    return { ok: true, threadId: `mock_${Date.now()}` };
  }

  try {
    const res = await fetch("https://api.typefully.com/v1/threads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profileId: config.profileId,
        teamId: config.teamId ?? undefined,
        draft: false,
        posts: posts.map((text) => ({ text })),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: err };
    }

    type ThreadResponse = { id?: string; threadId?: string; [k: string]: unknown };
    const data: ThreadResponse = await res.json();
    return { ok: true, threadId: data.id || data.threadId, response: data };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to queue thread";
    return { ok: false, error: message };
  }
}
