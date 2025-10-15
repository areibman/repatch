import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  publishPatchNoteToGitHub,
  inferRepositoryFromUrl,
} from "@/lib/github-publisher";
import type { PublishTarget } from "@/lib/github-publisher";
import type { Database } from "@/lib/supabase/database.types";

function parseTarget(value: unknown): PublishTarget | null {
  if (typeof value !== "string") {
    return "release";
  }

  const normalized = value.toLowerCase() as PublishTarget;
  if (
    normalized === "release" ||
    normalized === "discussion" ||
    normalized === "release-and-discussion"
  ) {
    return normalized;
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  let body: Partial<{ target: PublishTarget; discussionCategory?: string }> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const target = parseTarget(body.target) ?? "release";
  const discussionCategory =
    typeof body.discussionCategory === "string"
      ? body.discussionCategory.trim() || undefined
      : undefined;

  const { data: patchNote, error: patchNoteError } = await supabase
    .from("patch_notes")
    .select("*")
    .eq("id", id)
    .single();

  if (patchNoteError || !patchNote) {
    return NextResponse.json({ error: "Patch note not found" }, { status: 404 });
  }

  if (patchNote.github_publish_status === "publishing") {
    return NextResponse.json(
      { error: "Publish to GitHub is already in progress" },
      { status: 409 }
    );
  }

  const releaseAlready = Boolean(
    patchNote.github_release_id && patchNote.github_release_url
  );
  const discussionAlready = Boolean(
    patchNote.github_discussion_id && patchNote.github_discussion_url
  );

  const wantsRelease = target === "release" || target === "release-and-discussion";
  const wantsDiscussion =
    target === "discussion" || target === "release-and-discussion";

  if (
    patchNote.github_publish_status === "succeeded" &&
    (!wantsRelease || releaseAlready) &&
    (!wantsDiscussion || discussionAlready)
  ) {
    return NextResponse.json({
      status: "succeeded",
      patchNote,
      message: "Patch note already published to GitHub",
    });
  }

  let effectiveTarget: PublishTarget = target;

  if (releaseAlready && effectiveTarget === "release") {
    return NextResponse.json({
      status: "succeeded",
      patchNote,
      message: "GitHub release already exists for this patch note",
    });
  }

  if (releaseAlready && effectiveTarget === "release-and-discussion") {
    effectiveTarget = "discussion";
  }

  if (discussionAlready && effectiveTarget === "discussion") {
    return NextResponse.json({
      status: "succeeded",
      patchNote,
      message: "GitHub discussion already exists for this patch note",
    });
  }

  const { data: config, error: configError } = await supabase
    .from("github_configs")
    .select("repo_owner, repo_name, access_token")
    .eq("repo_url", patchNote.repo_url)
    .maybeSingle();

  if (configError) {
    return NextResponse.json(
      { error: configError.message },
      { status: 500 }
    );
  }

  if (!config) {
    return NextResponse.json(
      { error: "GitHub credentials are not configured for this repository" },
      { status: 400 }
    );
  }

  const repoInfo = inferRepositoryFromUrl(
    patchNote.repo_url,
    config.repo_owner,
    config.repo_name
  );

  if (!repoInfo) {
    return NextResponse.json(
      { error: "Could not determine GitHub repository owner and name" },
      { status: 400 }
    );
  }

  const setPublishing = await supabase
    .from("patch_notes")
    .update({
      github_publish_status: "publishing",
      github_publish_error: null,
    })
    .eq("id", id);

  if (setPublishing.error) {
    return NextResponse.json(
      { error: "Failed to update publishing status" },
      { status: 500 }
    );
  }

  try {
    const publishResult = await publishPatchNoteToGitHub({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      accessToken: config.access_token,
      title: patchNote.title,
      body: `# ${patchNote.title}\n\n${patchNote.content}`,
      tagName: `repatch-${patchNote.id}`,
      target: effectiveTarget,
      discussionCategory,
    });

    const updatePayload: Database["public"]["Tables"]["patch_notes"]["Update"] = {
      github_publish_status: "succeeded",
      github_publish_error: null,
      github_published_at: new Date().toISOString(),
    };

    if (publishResult.release) {
      updatePayload.github_release_id = publishResult.release.id;
      updatePayload.github_release_url = publishResult.release.htmlUrl;
    }

    if (publishResult.discussion) {
      updatePayload.github_discussion_id = publishResult.discussion.id;
      updatePayload.github_discussion_url = publishResult.discussion.htmlUrl;
    }

    const { data: updatedPatchNote, error: updateError } = await supabase
      .from("patch_notes")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !updatedPatchNote) {
      throw new Error(updateError?.message || "Failed to persist GitHub metadata");
    }

    return NextResponse.json({
      status: "succeeded",
      patchNote: updatedPatchNote,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to publish patch note to GitHub";

    await supabase
      .from("patch_notes")
      .update({
        github_publish_status: "failed",
        github_publish_error: message.slice(0, 500),
      })
      .eq("id", id);

    console.error("GitHub publish error", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
