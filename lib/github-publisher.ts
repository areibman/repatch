import type { Database } from "@/lib/supabase/database.types";
import { parseGitHubUrl } from "@/lib/github";

export type GitHubPublishTarget = "release" | "discussion" | "both";

type PatchNoteRow = Database["public"]["Tables"]["patch_notes"]["Row"];

type GitHubRelease = {
  id: number;
  html_url: string;
  tag_name: string;
};

type GitHubDiscussion = {
  id: number;
  html_url: string;
};

type PublishOptions = {
  patchNote: PatchNoteRow;
  token: string;
  owner: string;
  repo: string;
  target: GitHubPublishTarget;
  tagName?: string;
  discussionCategoryName?: string;
  retries?: number;
};

export type PublishResult = {
  status: "published" | "partial" | "failed";
  release: GitHubRelease | null;
  discussion: GitHubDiscussion | null;
  errors: string[];
};

const DEFAULT_RETRIES = 3;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

export function buildDefaultGitHubTagName(note: PatchNoteRow): string {
  const repoSegment = slugify(note.repo_name.replace(/\//g, "-"));
  const dateSegment = new Date(note.generated_at).toISOString().split("T")[0];
  const base = slugify(`repatch-${repoSegment}-${note.time_period}-${dateSegment}`);
  if (!base) {
    return `repatch-${note.id.slice(0, 8).toLowerCase()}`;
  }
  return `${base}-${note.id.slice(0, 8).toLowerCase()}`;
}

function buildPublishBody(note: PatchNoteRow): string {
  const metadata = [
    "## Repository metadata",
    `- **Repository:** [${note.repo_name}](${note.repo_url})`,
    `- **Time period:** ${note.time_period}`,
    `- **Generated at:** ${new Date(note.generated_at).toISOString()}`,
  ].join("\n");

  const contributors = (note.contributors ?? []).length
    ? [
        "\n## Contributors",
        ...(note.contributors ?? []).map((contributor) => `- ${contributor}`),
      ].join("\n")
    : "";

  const changes = note.changes
    ? [
        "\n## Change summary",
        `- **Added:** ${note.changes.added.toLocaleString()} lines`,
        `- **Removed:** ${note.changes.removed.toLocaleString()} lines`,
        `- **Modified:** ${note.changes.modified.toLocaleString()} lines`,
      ].join("\n")
    : "";

  return [
    note.content?.trim() ?? "",
    metadata,
    contributors,
    changes,
    "\n> Published via Repatch.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function extractError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data?.errors && Array.isArray(data.errors)) {
      return data.errors.map((error: any) => error.message ?? String(error)).join("; ");
    }
    if (data?.message) {
      return data.message as string;
    }
    return JSON.stringify(data);
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

async function githubRequest(
  url: string,
  token: string,
  init: RequestInit,
  retries = DEFAULT_RETRIES
): Promise<Response> {
  let attempt = 0;
  let lastError = "";

  while (attempt < retries) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Repatch-App",
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });

    if (response.ok) {
      return response;
    }

    const errorMessage = await extractError(response);
    lastError = errorMessage;

    if ((response.status >= 500 || response.status === 429) && attempt < retries - 1) {
      await delay(500 * Math.max(1, attempt + 1));
      attempt += 1;
      continue;
    }

    throw new Error(errorMessage);
  }

  throw new Error(lastError || "GitHub request failed");
}

async function createGitHubRelease(
  params: PublishOptions & { body: string; tagName: string }
): Promise<GitHubRelease> {
  const response = await githubRequest(
    `https://api.github.com/repos/${params.owner}/${params.repo}/releases`,
    params.token,
    {
      method: "POST",
      body: JSON.stringify({
        tag_name: params.tagName,
        name: params.patchNote.title,
        body: params.body,
        make_latest: "true",
      }),
    },
    params.retries ?? DEFAULT_RETRIES
  );

  const release = (await response.json()) as any;
  return {
    id: release.id,
    html_url: release.html_url,
    tag_name: release.tag_name,
  };
}

async function resolveDiscussionCategoryId(
  owner: string,
  repo: string,
  token: string,
  categoryName: string,
  retries = DEFAULT_RETRIES
): Promise<number> {
  const response = await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/discussions/categories`,
    token,
    { method: "GET" },
    retries ?? DEFAULT_RETRIES
  );

  const categories = (await response.json()) as Array<{ id: number; name: string }>;
  const match = categories.find(
    (category) => category.name.toLowerCase() === categoryName.toLowerCase()
  );

  if (!match) {
    throw new Error(`Discussion category \"${categoryName}\" was not found.`);
  }

  return match.id;
}

async function createGitHubDiscussion(
  params: PublishOptions & { body: string; releaseUrl?: string | null }
): Promise<GitHubDiscussion> {
  if (!params.discussionCategoryName) {
    throw new Error("A discussion category is required to publish to discussions.");
  }

  const categoryId = await resolveDiscussionCategoryId(
    params.owner,
    params.repo,
    params.token,
    params.discussionCategoryName,
    params.retries
  );

  const body = params.releaseUrl
    ? `${params.body}\n\n---\n[View related release](${params.releaseUrl})`
    : params.body;

  const response = await githubRequest(
    `https://api.github.com/repos/${params.owner}/${params.repo}/discussions`,
    params.token,
    {
      method: "POST",
      body: JSON.stringify({
        title: params.patchNote.title,
        body,
        category_id: categoryId,
      }),
    },
    params.retries ?? DEFAULT_RETRIES
  );

  const discussion = (await response.json()) as any;
  return {
    id: discussion.id,
    html_url: discussion.html_url,
  };
}

export async function publishPatchNoteToGitHub(
  options: PublishOptions
): Promise<PublishResult> {
  const { patchNote, token, owner, repo, target } = options;
  const releaseRequested = target === "release" || target === "both";
  const discussionRequested = target === "discussion" || target === "both";
  const errors: string[] = [];
  const body = buildPublishBody(patchNote);
  const requestedTag = options.tagName ? slugify(options.tagName) : "";
  const tagName = requestedTag || buildDefaultGitHubTagName(patchNote);

  let release: GitHubRelease | null = null;
  let discussion: GitHubDiscussion | null = null;

  if (releaseRequested) {
    try {
      release = await createGitHubRelease({
        ...options,
        body,
        tagName,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (discussionRequested) {
    try {
      discussion = await createGitHubDiscussion({
        ...options,
        body,
        releaseUrl: release?.html_url ?? null,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  let status: PublishResult["status"] = "published";
  if (errors.length > 0 && (release || discussion)) {
    status = "partial";
  } else if (errors.length > 0) {
    status = "failed";
  }

  return {
    status,
    release,
    discussion,
    errors,
  };
}

export function resolveOwnerRepo(
  repoUrl: string,
  fallbackOwner?: string | null,
  fallbackRepo?: string | null
): { owner: string; repo: string } | null {
  if (fallbackOwner && fallbackRepo) {
    return { owner: fallbackOwner, repo: fallbackRepo };
  }

  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return null;
  }

  return parsed;
}
