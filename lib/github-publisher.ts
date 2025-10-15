import { parseGitHubUrl } from "@/lib/github";

export type PublishTarget = "release" | "discussion" | "release-and-discussion";

interface PublishPatchNoteParams {
  owner: string;
  repo: string;
  accessToken: string;
  title: string;
  body: string;
  tagName: string;
  target: PublishTarget;
  discussionCategory?: string | null;
}

interface ReleaseResult {
  id: string;
  htmlUrl: string;
  discussionUrl?: string | null;
}

interface DiscussionResult {
  id: string;
  htmlUrl: string;
}

export interface PublishPatchNoteResult {
  release?: ReleaseResult | null;
  discussion?: DiscussionResult | null;
}

const API_VERSION = "2022-11-28";

function buildHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "Repatch-App",
    "X-GitHub-Api-Version": API_VERSION,
  };
}

async function parseGitHubError(response: Response, fallback: string) {
  try {
    const data = await response.json();
    if (typeof data?.message === "string" && data.message.length > 0) {
      return data.message;
    }
  } catch {
    // ignore JSON parsing failures
  }
  return `${fallback} (${response.status} ${response.statusText})`;
}

async function createRelease(
  params: PublishPatchNoteParams,
  headers: HeadersInit
): Promise<ReleaseResult> {
  const releaseResponse = await fetch(
    `https://api.github.com/repos/${params.owner}/${params.repo}/releases`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        tag_name: params.tagName,
        name: params.title,
        body: params.body,
        draft: false,
        prerelease: false,
        discussion_category_name:
          params.target === "release-and-discussion"
            ? params.discussionCategory || undefined
            : undefined,
      }),
    }
  );

  if (!releaseResponse.ok) {
    const message = await parseGitHubError(
      releaseResponse,
      "Failed to create GitHub release"
    );
    throw new Error(message);
  }

  const releaseData = await releaseResponse.json();
  return {
    id: String(releaseData?.id ?? releaseData?.node_id ?? params.tagName),
    htmlUrl: releaseData?.html_url ?? "",
    discussionUrl: releaseData?.discussion_url ?? null,
  };
}

async function resolveDiscussionCategory(
  owner: string,
  repo: string,
  headers: HeadersInit,
  requestedCategory?: string | null
): Promise<{ id: number; slug?: string } | null> {
  const categoriesResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/discussions/categories`,
    {
      headers,
    }
  );

  if (!categoriesResponse.ok) {
    const message = await parseGitHubError(
      categoriesResponse,
      "Failed to load GitHub discussion categories"
    );
    throw new Error(message);
  }

  const categories = (await categoriesResponse.json()) as Array<{
    id: number;
    slug: string;
    name: string;
  }>;

  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error("Repository has no available discussion categories");
  }

  if (requestedCategory) {
    const normalized = requestedCategory.toLowerCase();
    const match = categories.find(
      (category) =>
        category.slug.toLowerCase() === normalized ||
        category.name.toLowerCase() === normalized
    );
    if (match) {
      return match;
    }
  }

  return categories[0];
}

async function createDiscussion(
  params: PublishPatchNoteParams,
  headers: HeadersInit
): Promise<DiscussionResult> {
  const category = await resolveDiscussionCategory(
    params.owner,
    params.repo,
    headers,
    params.discussionCategory
  );

  if (!category) {
    throw new Error("No GitHub discussion category could be resolved");
  }

  const discussionResponse = await fetch(
    `https://api.github.com/repos/${params.owner}/${params.repo}/discussions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: params.title,
        body: params.body,
        category_id: category.id,
      }),
    }
  );

  if (!discussionResponse.ok) {
    const message = await parseGitHubError(
      discussionResponse,
      "Failed to create GitHub discussion"
    );
    throw new Error(message);
  }

  const discussionData = await discussionResponse.json();
  return {
    id: String(
      discussionData?.node_id ?? discussionData?.id ?? discussionData?.number
    ),
    htmlUrl: discussionData?.html_url ?? "",
  };
}

async function fetchDiscussionByUrl(
  url: string,
  headers: HeadersInit
): Promise<DiscussionResult | null> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    return null;
  }
  try {
    const data = await response.json();
    return {
      id: String(data?.node_id ?? data?.id ?? data?.number ?? ""),
      htmlUrl: data?.html_url ?? url,
    };
  } catch {
    return { id: url, htmlUrl: url };
  }
}

export async function publishPatchNoteToGitHub(
  params: PublishPatchNoteParams
): Promise<PublishPatchNoteResult> {
  const headers = buildHeaders(params.accessToken);
  const result: PublishPatchNoteResult = {};

  if (params.target !== "discussion") {
    const release = await createRelease(params, headers);
    result.release = release;

    if (params.target !== "release" && release.discussionUrl) {
      const discussionFromRelease = await fetchDiscussionByUrl(
        release.discussionUrl,
        headers
      );
      if (discussionFromRelease) {
        result.discussion = discussionFromRelease;
        return result;
      }
    }
  }

  if (params.target !== "release") {
    result.discussion = await createDiscussion(params, headers);
  }

  return result;
}

export function inferRepositoryFromUrl(
  repoUrl: string,
  fallbackOwner?: string | null,
  fallbackRepo?: string | null
): { owner: string; repo: string } | null {
  if (fallbackOwner && fallbackRepo) {
    return { owner: fallbackOwner, repo: fallbackRepo };
  }

  return parseGitHubUrl(repoUrl);
}
