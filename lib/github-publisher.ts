import { Database } from "@/lib/supabase/database.types";
import { parseGitHubUrl } from "./github";

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
const DEFAULT_DISCUSSION_SLUGS = ["announcements", "general"];

type DbPatchNote = Database["public"]["Tables"]["patch_notes"]["Row"];

export type GitHubPublishTarget = "release" | "discussion";

export type GitHubPublishResult =
  | {
      target: "release";
      releaseId: string;
      releaseUrl: string;
      releaseTag: string;
    }
  | {
      target: "discussion";
      discussionId: string;
      discussionUrl: string;
      discussionCategorySlug: string;
      discussionCategoryId: number;
    };

export interface PublishPatchNoteOptions {
  patchNote: DbPatchNote;
  accessToken: string;
  target: GitHubPublishTarget;
  tagName?: string;
  discussionCategorySlug?: string | null;
}

export class GitHubPublisherError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "GitHubPublisherError";
    this.status = status;
    this.details = details;
  }
}

interface GitHubErrorShape {
  message?: string;
  documentation_url?: string;
  errors?: Array<{ message?: string }>;
}

function githubHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "Repatch-App",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

async function readGitHubError(response: Response): Promise<GitHubPublisherError> {
  let message = `GitHub API error: ${response.status} ${response.statusText}`;
  let details: GitHubErrorShape | undefined;

  try {
    details = (await response.json()) as GitHubErrorShape;
    if (details?.message) {
      message = details.message;
    }
    if (details?.errors?.length) {
      const nested = details.errors.find((error) => error.message);
      if (nested?.message) {
        message = `${message}: ${nested.message}`;
      }
    }
  } catch {
    // Ignore JSON parse failure
  }

  return new GitHubPublisherError(message, response.status, details);
}

function resolveOwnerRepo(patchNote: DbPatchNote): { owner: string; repo: string } {
  const parsed = parseGitHubUrl(patchNote.repo_url);
  if (!parsed) {
    throw new GitHubPublisherError(
      `Unable to determine GitHub owner and repository from URL: ${patchNote.repo_url}`
    );
  }
  return parsed;
}

function coerceTagName(options: PublishPatchNoteOptions): string {
  if (options.tagName?.trim()) {
    return options.tagName.trim();
  }

  const timestampSource = options.patchNote.generated_at ?? options.patchNote.created_at;
  const timestamp = new Date(timestampSource);
  const formatted = Number.isNaN(timestamp.getTime())
    ? new Date().toISOString().split("T")[0]
    : timestamp.toISOString().split("T")[0];
  return `patch-note-${formatted}`;
}

async function publishRelease(options: PublishPatchNoteOptions): Promise<GitHubPublishResult> {
  const { owner, repo } = resolveOwnerRepo(options.patchNote);
  const tagName = coerceTagName(options);

  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/releases`, {
    method: "POST",
    headers: githubHeaders(options.accessToken),
    body: JSON.stringify({
      tag_name: tagName,
      name: options.patchNote.title,
      body: options.patchNote.content,
      draft: false,
      prerelease: false,
    }),
  });

  if (!response.ok) {
    throw await readGitHubError(response);
  }

  const release = (await response.json()) as {
    id: number;
    html_url: string;
    tag_name: string;
  };

  return {
    target: "release",
    releaseId: String(release.id),
    releaseUrl: release.html_url,
    releaseTag: release.tag_name,
  };
}

interface DiscussionCategory {
  id: number;
  slug: string;
  is_answerable?: boolean;
}

async function fetchDiscussionCategories(
  token: string,
  owner: string,
  repo: string
): Promise<DiscussionCategory[]> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/discussions/categories`,
    {
      method: "GET",
      headers: githubHeaders(token),
    }
  );

  if (!response.ok) {
    throw await readGitHubError(response);
  }

  const categories = (await response.json()) as { categories?: DiscussionCategory[] };
  if (Array.isArray(categories)) {
    return categories as DiscussionCategory[];
  }
  if (Array.isArray(categories.categories)) {
    return categories.categories;
  }
  return [];
}

async function resolveDiscussionCategory(
  options: PublishPatchNoteOptions,
  owner: string,
  repo: string
): Promise<{ category: DiscussionCategory; slug: string }> {
  const desiredSlugs = [
    ...(options.discussionCategorySlug?.trim()
      ? [options.discussionCategorySlug.trim().toLowerCase()]
      : []),
    ...DEFAULT_DISCUSSION_SLUGS,
  ];

  const categories = await fetchDiscussionCategories(
    options.accessToken,
    owner,
    repo
  );

  for (const slug of desiredSlugs) {
    const match = categories.find((category) => category.slug === slug);
    if (match) {
      return { category: match, slug };
    }
  }

  if (categories.length === 0) {
    throw new GitHubPublisherError(
      "No GitHub discussion categories are available for this repository."
    );
  }

  const fallback = categories[0];
  return { category: fallback, slug: fallback.slug };
}

async function publishDiscussion(
  options: PublishPatchNoteOptions
): Promise<GitHubPublishResult> {
  const { owner, repo } = resolveOwnerRepo(options.patchNote);
  const { category, slug } = await resolveDiscussionCategory(options, owner, repo);

  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/discussions`, {
    method: "POST",
    headers: githubHeaders(options.accessToken),
    body: JSON.stringify({
      title: options.patchNote.title,
      body: options.patchNote.content,
      category_id: category.id,
    }),
  });

  if (!response.ok) {
    throw await readGitHubError(response);
  }

  const discussion = (await response.json()) as {
    id?: number;
    number?: number;
    html_url: string;
  };

  const id = discussion.id ?? discussion.number;
  if (!id) {
    throw new GitHubPublisherError(
      "GitHub discussion response did not include an identifier."
    );
  }

  return {
    target: "discussion",
    discussionId: String(id),
    discussionUrl: discussion.html_url,
    discussionCategorySlug: slug,
    discussionCategoryId: category.id,
  };
}

export async function publishPatchNoteToGitHub(
  options: PublishPatchNoteOptions
): Promise<GitHubPublishResult> {
  if (!options.accessToken) {
    throw new GitHubPublisherError(
      "Missing GitHub access token. Save a token for this repository before publishing."
    );
  }

  if (options.target === "release") {
    return publishRelease(options);
  }

  return publishDiscussion(options);
}
