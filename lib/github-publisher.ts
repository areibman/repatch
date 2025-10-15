import { Database } from "@/lib/supabase/database.types";
import { parseGitHubUrl } from "@/lib/github";
import { GitHubPublishTarget } from "@/types/patch-note";

type PatchNoteRow = Database["public"]["Tables"]["patch_notes"]["Row"];

type GitHubConfigRow = {
  repo_owner: string | null;
  repo_name: string | null;
  access_token: string;
  repo_url: string;
};

interface PublishOptions {
  patchNote: PatchNoteRow;
  target: GitHubPublishTarget;
  config: GitHubConfigRow;
}

interface PublishResult {
  id: string;
  url: string;
  target: GitHubPublishTarget;
}

const GITHUB_API_VERSION = "2022-11-28";

class GitHubPublisherError extends Error {
  constructor(message: string, public readonly responseStatus?: number) {
    super(message);
    this.name = "GitHubPublisherError";
  }
}

function createGitHubHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "Repatch-App",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

async function withRetry<T>(action: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError;
}

function resolveRepository(config: GitHubConfigRow) {
  if (config.repo_owner && config.repo_name) {
    return { owner: config.repo_owner, repo: config.repo_name };
  }

  const parsed = parseGitHubUrl(config.repo_url);
  if (!parsed) {
    throw new GitHubPublisherError(
      "Unable to determine GitHub repository owner or name from configuration"
    );
  }
  return parsed;
}

async function publishRelease(
  patchNote: PatchNoteRow,
  config: GitHubConfigRow
): Promise<PublishResult> {
  const { owner, repo } = resolveRepository(config);
  const headers = createGitHubHeaders(config.access_token);
  const tagName = `repatch-${patchNote.id}`;

  const response = await withRetry(async () => {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          tag_name: tagName,
          name: patchNote.title,
          body: patchNote.content,
          draft: false,
          generate_release_notes: false,
        }),
      }
    );

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      throw new GitHubPublisherError(
        errorBody?.message || "GitHub rejected the release request",
        res.status
      );
    }

    return res.json();
  });

  return {
    id: String(response.id ?? response.node_id ?? tagName),
    url: String(response.html_url ?? response.url ?? ""),
    target: "release",
  };
}

async function fetchDiscussionCategory(
  headers: HeadersInit,
  owner: string,
  repo: string
): Promise<string> {
  const categories = await withRetry(async () => {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/discussions/categories`,
      {
        headers,
      }
    );

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      throw new GitHubPublisherError(
        errorBody?.message || "Failed to load discussion categories",
        res.status
      );
    }

    return res.json();
  });

  const list =
    categories?.repository_discussion_categories ?? categories?.categories ?? [];

  if (!Array.isArray(list) || list.length === 0) {
    throw new GitHubPublisherError(
      "This repository does not have any discussion categories configured"
    );
  }

  const defaultCategory =
    list.find((category: any) => category.default) ||
    list.find((category: any) => category.is_answerable === false) ||
    list[0];

  if (!defaultCategory?.id) {
    throw new GitHubPublisherError(
      "Unable to determine a GitHub discussion category for publishing"
    );
  }

  return String(defaultCategory.id);
}

async function publishDiscussion(
  patchNote: PatchNoteRow,
  config: GitHubConfigRow
): Promise<PublishResult> {
  const { owner, repo } = resolveRepository(config);
  const headers = createGitHubHeaders(config.access_token);
  const categoryId = await fetchDiscussionCategory(headers, owner, repo);

  const response = await withRetry(async () => {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/discussions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: patchNote.title,
          body: patchNote.content,
          category_id: categoryId,
        }),
      }
    );

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      throw new GitHubPublisherError(
        errorBody?.message || "GitHub rejected the discussion request",
        res.status
      );
    }

    return res.json();
  });

  return {
    id: String(response.id ?? response.node_id ?? response.number ?? ""),
    url: String(response.html_url ?? response.url ?? ""),
    target: "discussion",
  };
}

export async function publishPatchNoteToGitHub(
  options: PublishOptions
): Promise<PublishResult> {
  const { patchNote, target, config } = options;

  if (!config.access_token) {
    throw new GitHubPublisherError("GitHub access token is missing from config");
  }

  if (target === "release") {
    return publishRelease(patchNote, config);
  }

  return publishDiscussion(patchNote, config);
}

export { GitHubPublisherError };
