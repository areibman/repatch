import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publishPatchNoteToGitHub } from "@/lib/github-publisher";
import { GitHubPublisherError } from "@/lib/github-publisher";
import { Database } from "@/lib/supabase/database.types";
import { GitHubPublishTarget } from "@/types/patch-note";

const PublishSchema = z.object({
  target: z.enum(["release", "discussion"]),
});

type PatchNoteRow = Database["public"]["Tables"]["patch_notes"]["Row"];

type GitHubConfig = Database["public"]["Tables"]["github_configs"]["Row"];

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: patchNoteId } = await params;
  let target: GitHubPublishTarget | null = null;
  let attemptTimestamp: string | null = null;

  try {
    const body = await request.json();
    const parsed = PublishSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Invalid publish request payload", 400);
    }

    target = parsed.data.target as GitHubPublishTarget;

    const { data: patchNote, error: patchNoteError } = await supabase
      .from("patch_notes")
      .select("*")
      .eq("id", patchNoteId)
      .single<PatchNoteRow>();

    if (patchNoteError || !patchNote) {
      return errorResponse("Patch note not found", 404);
    }

    const { data: githubConfig, error: configError } = await supabase
      .from("github_configs")
      .select("id, repo_owner, repo_name, repo_url, access_token")
      .eq("repo_url", patchNote.repo_url)
      .maybeSingle<GitHubConfig>();

    if (configError) {
      return errorResponse(configError.message, 500);
    }

    if (!githubConfig) {
      return errorResponse(
        "Connect GitHub credentials for this repository before publishing.",
        412
      );
    }

    if (!githubConfig.access_token) {
      return errorResponse(
        "Stored GitHub credentials are missing a token. Update the integration and try again.",
        412
      );
    }

    attemptTimestamp = new Date().toISOString();

    await supabase
      .from("patch_notes")
      .update({
        github_publish_status: "publishing",
        github_publish_target: target,
        github_publish_error: null,
        github_publish_attempted_at: attemptTimestamp,
      })
      .eq("id", patchNoteId);

    const result = await publishPatchNoteToGitHub({
      patchNote,
      target,
      config: {
        repo_owner: githubConfig.repo_owner,
        repo_name: githubConfig.repo_name,
        repo_url: githubConfig.repo_url,
        access_token: githubConfig.access_token,
      },
    });

    const completionTimestamp = new Date().toISOString();

    const updatePayload: Database["public"]["Tables"]["patch_notes"]["Update"] = {
      github_publish_status: "published",
      github_publish_target: target,
      github_publish_error: null,
      github_publish_completed_at: completionTimestamp,
    };

    if (target === "release") {
      updatePayload.github_release_id = result.id;
      updatePayload.github_release_url = result.url;
    } else {
      updatePayload.github_discussion_id = result.id;
      updatePayload.github_discussion_url = result.url;
    }

    const { data: updatedPatchNote, error: updateError } = await supabase
      .from("patch_notes")
      .update(updatePayload)
      .eq("id", patchNoteId)
      .select("*")
      .single<PatchNoteRow>();

    if (updateError || !updatedPatchNote) {
      throw new Error(updateError?.message || "Failed to persist publish metadata");
    }

    return NextResponse.json({
      ok: true,
      target,
      url: result.url,
      patchNote: updatedPatchNote,
    });
  } catch (error) {
    const message =
      error instanceof GitHubPublisherError
        ? error.message
        : error instanceof Error
        ? error.message
        : "Failed to publish patch note to GitHub";

    await supabase
      .from("patch_notes")
      .update({
        github_publish_status: "failed",
        ...(target ? { github_publish_target: target } : {}),
        github_publish_error: message,
        ...(attemptTimestamp
          ? { github_publish_attempted_at: attemptTimestamp }
          : {}),
      })
      .eq("id", patchNoteId);

    const status = error instanceof GitHubPublisherError ? 502 : 500;
    return errorResponse(message, status);
  }
}
