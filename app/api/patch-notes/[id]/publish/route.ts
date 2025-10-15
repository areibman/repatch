import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/lib/supabase/database.types";
import {
  GitHubPublisherError,
  publishPatchNoteToGitHub,
} from "@/lib/github-publisher";

const MAX_BACKOFF_MINUTES = 60;

function computeNextRetry(attempts: number): string {
  const exponent = Math.max(attempts - 1, 0);
  const minutes = Math.min(MAX_BACKOFF_MINUTES, 2 ** exponent);
  const retryDate = new Date(Date.now() + minutes * 60 * 1000);
  return retryDate.toISOString();
}

type PatchNoteRow = Database["public"]["Tables"]["patch_notes"]["Row"];

type PublishBody = {
  target?: "release" | "discussion";
  tagName?: string;
  discussionCategorySlug?: string | null;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  let body: PublishBody = {};
  try {
    body = await request.json();
  } catch {
    // No body provided is acceptable
  }

  const target = body.target ?? "release";
  if (target !== "release" && target !== "discussion") {
    return NextResponse.json(
      { error: "Invalid publish target. Must be 'release' or 'discussion'." },
      { status: 400 }
    );
  }

  const { data: patchNote, error: patchNoteError } = await supabase
    .from("patch_notes")
    .select("*")
    .eq("id", id)
    .single<PatchNoteRow>();

  if (patchNoteError || !patchNote) {
    return NextResponse.json(
      { error: patchNoteError?.message ?? "Patch note not found." },
      { status: 404 }
    );
  }

  const { data: config, error: configError } = await supabase
    .from("github_configs")
    .select("access_token")
    .eq("repo_url", patchNote.repo_url)
    .maybeSingle<{ access_token: string }>();

  if (configError) {
    return NextResponse.json(
      { error: configError.message ?? "Failed to load GitHub credentials." },
      { status: 500 }
    );
  }

  if (!config?.access_token) {
    return NextResponse.json(
      {
        error:
          "No GitHub access token is stored for this repository. Save credentials before publishing.",
      },
      { status: 400 }
    );
  }

  const attempts = (patchNote.github_publish_attempts ?? 0) + 1;

  const { error: stageError } = await supabase
    .from("patch_notes")
    .update({
      github_publish_status: "publishing",
      github_publish_target: target,
      github_publish_error: null,
      github_publish_attempts: attempts,
      github_publish_next_retry_at: null,
    })
    .eq("id", id);

  if (stageError) {
    return NextResponse.json(
      { error: stageError.message ?? "Failed to mark patch note as publishing." },
      { status: 500 }
    );
  }

  try {
    const publishResult = await publishPatchNoteToGitHub({
      patchNote,
      accessToken: config.access_token,
      target,
      tagName: body.tagName,
      discussionCategorySlug: body.discussionCategorySlug,
    });

    const successUpdate: Partial<PatchNoteRow> = {
      github_publish_status: "published",
      github_publish_target: target,
      github_publish_error: null,
      github_last_published_at: new Date().toISOString(),
      github_publish_attempts: attempts,
      github_publish_next_retry_at: null,
    };

    if (publishResult.target === "release") {
      successUpdate.github_release_id = publishResult.releaseId;
      successUpdate.github_release_url = publishResult.releaseUrl;
      successUpdate.github_release_tag = publishResult.releaseTag;
    } else {
      successUpdate.github_discussion_id = publishResult.discussionId;
      successUpdate.github_discussion_url = publishResult.discussionUrl;
      successUpdate.github_discussion_category_slug =
        publishResult.discussionCategorySlug;
    }

    const { data: updated, error: updateError } = await supabase
      .from("patch_notes")
      // @ts-expect-error Partial update matches table schema
      .update(successUpdate)
      .eq("id", id)
      .select()
      .single<PatchNoteRow>();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "Failed to persist publish metadata.");
    }

    return NextResponse.json(updated);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to publish patch note to GitHub.";
    const status =
      error instanceof GitHubPublisherError && error.status
        ? error.status
        : 500;
    const nextRetryAt = computeNextRetry(attempts);

    const failureUpdate: Partial<PatchNoteRow> = {
      github_publish_status: "failed",
      github_publish_target: target,
      github_publish_error: message,
      github_publish_attempts: attempts,
      github_publish_next_retry_at: nextRetryAt,
    };

    const { data: failedState } = await supabase
      .from("patch_notes")
      // @ts-expect-error Partial update matches table schema
      .update(failureUpdate)
      .eq("id", id)
      .select()
      .single<PatchNoteRow>();

    return NextResponse.json(
      {
        error: message,
        details: error instanceof GitHubPublisherError ? error.details : undefined,
        patchNote: failedState ?? null,
      },
      { status }
    );
  }
}
