import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  publishPatchNoteToGitHub,
  resolveOwnerRepo,
  buildDefaultGitHubTagName,
} from "@/lib/github-publisher";
import type { GitHubPublishTarget } from "@/lib/github-publisher";

const publishSchema = z.object({
  target: z.enum(["release", "discussion", "both"]),
  tagName: z.string().optional(),
  discussionCategoryName: z.string().optional(),
});

type PatchNoteRow = Database["public"]["Tables"]["patch_notes"]["Row"];
type GithubConfigRow = {
  access_token: string;
  repo_owner: string | null;
  repo_name: string | null;
  repo_url: string;
};

type PublishResponseBody = {
  status: "published" | "partial" | "failed";
  release: { id: number; url: string } | null;
  discussion: { id: number; url: string } | null;
  error: string | null;
  patchNote: PatchNoteRow | null;
};

function buildErrorResponse(
  message: string,
  status: number,
  patchNote: PatchNoteRow | null
) {
  return NextResponse.json<PublishResponseBody>(
    {
      status: "failed",
      release: null,
      discussion: null,
      error: message,
      patchNote,
    },
    { status }
  );
}

function normalizeTarget(
  requested: GitHubPublishTarget,
  patchNote: PatchNoteRow
): GitHubPublishTarget {
  const hasRelease = Boolean(patchNote.github_release_id);
  const hasDiscussion = Boolean(patchNote.github_discussion_id);

  if (requested === "both") {
    if (hasRelease && hasDiscussion) {
      return "both";
    }
    if (hasRelease) {
      return "discussion";
    }
    if (hasDiscussion) {
      return "release";
    }
  }

  return requested;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const rawBody = await request.json();
  const parsed = publishSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid publish request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const body = parsed.data;

  const { data: patchNote, error: patchNoteError } = await supabase
    .from("patch_notes")
    .select("*")
    .eq("id", id)
    .single<PatchNoteRow>();

  if (patchNoteError || !patchNote) {
    return buildErrorResponse("Patch note not found", 404, null);
  }

  let target: GitHubPublishTarget = normalizeTarget(body.target, patchNote);

  const hasRelease = Boolean(patchNote.github_release_id);
  const hasDiscussion = Boolean(patchNote.github_discussion_id);

  if (target === "release" && hasRelease) {
    return buildErrorResponse("This patch note already has a GitHub release.", 409, patchNote);
  }

  if (target === "discussion" && hasDiscussion) {
    return buildErrorResponse(
      "This patch note already has a GitHub discussion.",
      409,
      patchNote
    );
  }

  if (target === "both" && hasRelease && hasDiscussion) {
    return buildErrorResponse(
      "This patch note already has both a release and a discussion.",
      409,
      patchNote
    );
  }

  if ((target === "discussion" || target === "both") && !body.discussionCategoryName) {
    return buildErrorResponse(
      "A discussion category name is required to publish discussions.",
      400,
      patchNote
    );
  }

  const { data: githubConfig, error: githubError } = await supabase
    .from("github_configs")
    .select("access_token, repo_owner, repo_name, repo_url")
    .eq("repo_url", patchNote.repo_url)
    .maybeSingle<GithubConfigRow>();

  if (githubError || !githubConfig) {
    return buildErrorResponse(
      "No GitHub credentials found for this repository.",
      400,
      patchNote
    );
  }

  const ownerRepo = resolveOwnerRepo(
    githubConfig.repo_url,
    githubConfig.repo_owner,
    githubConfig.repo_name
  );

  if (!ownerRepo) {
    return buildErrorResponse("Unable to determine repository owner/name.", 400, patchNote);
  }

  const trimmedTag = body.tagName?.trim();
  const trimmedDiscussionCategory = body.discussionCategoryName?.trim();

  await supabase
    .from("patch_notes")
    .update({
      github_publish_status: "pending",
      github_publish_target: target,
      github_publish_error: null,
    })
    .eq("id", id);

  try {
    const publishResult = await publishPatchNoteToGitHub({
      patchNote,
      token: githubConfig.access_token,
      owner: ownerRepo.owner,
      repo: ownerRepo.repo,
      target,
      tagName: trimmedTag?.length ? trimmedTag : buildDefaultGitHubTagName(patchNote),
      discussionCategoryName: trimmedDiscussionCategory,
    });

    const errorMessage = publishResult.errors.join("; ") || null;
    const nowIso = new Date().toISOString();

    const updatedReleaseId = publishResult.release?.id ?? patchNote.github_release_id ?? null;
    const updatedReleaseUrl =
      publishResult.release?.html_url ?? patchNote.github_release_url ?? null;
    const updatedDiscussionId =
      publishResult.discussion?.id ?? patchNote.github_discussion_id ?? null;
    const updatedDiscussionUrl =
      publishResult.discussion?.html_url ?? patchNote.github_discussion_url ?? null;

    const shouldTimestamp =
      publishResult.status === "published" || publishResult.status === "partial";

    const { data: updatedNote, error: updateError } = await supabase
      .from("patch_notes")
      .update({
        github_publish_status: publishResult.status,
        github_publish_target: target,
        github_publish_error: errorMessage,
        github_release_id: updatedReleaseId,
        github_release_url: updatedReleaseUrl,
        github_discussion_id: updatedDiscussionId,
        github_discussion_url: updatedDiscussionUrl,
        github_published_at: shouldTimestamp
          ? nowIso
          : patchNote.github_published_at ?? null,
      })
      .eq("id", id)
      .select("*")
      .single<PatchNoteRow>();

    if (updateError || !updatedNote) {
      return buildErrorResponse("Failed to persist GitHub publish metadata.", 500, patchNote);
    }

    return NextResponse.json<PublishResponseBody>(
      {
        status: publishResult.status,
        release: publishResult.release
          ? { id: publishResult.release.id, url: publishResult.release.html_url }
          : updatedReleaseId
          ? { id: updatedReleaseId, url: updatedReleaseUrl! }
          : null,
        discussion: publishResult.discussion
          ? {
              id: publishResult.discussion.id,
              url: publishResult.discussion.html_url,
            }
          : updatedDiscussionId
          ? { id: updatedDiscussionId, url: updatedDiscussionUrl! }
          : null,
        error: errorMessage,
        patchNote: updatedNote,
      },
      { status: publishResult.status === "failed" ? 502 : 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to publish patch note to GitHub.";

    const { data: fallbackNote } = await supabase
      .from("patch_notes")
      .update({
        github_publish_status: "failed",
        github_publish_target: target,
        github_publish_error: errorMessage,
      })
      .eq("id", id)
      .select("*")
      .single<PatchNoteRow>();

    return buildErrorResponse(errorMessage, 502, fallbackNote ?? patchNote);
  }
}
