/**
 * Patch Note Process API Route
 * Thin HTTP adapter for the patch note processor service
 * 
 * This route now calls services directly instead of making HTTP requests
 * to other routes, eliminating unnecessary serialization and latency.
 */

import { NextRequest, NextResponse } from "next/server";
import { processPatchNote, type ProcessPatchNoteInput } from "@/lib/services";
import { cookies } from "next/headers";
import type { PatchNoteFilters } from "@/types/patch-note";
import { withApiAuth } from "@/lib/api/with-auth";

export const maxDuration = 300; // 5 minutes

/**
 * Validate request body and build service input
 */
function buildProcessInput(
  body: unknown,
  patchNoteId: string,
  cookieStore: ProcessPatchNoteInput['cookieStore']
): ProcessPatchNoteInput | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid request body' };
  }

  const obj = body as Record<string, unknown>;

  if (!obj.owner || typeof obj.owner !== 'string') {
    return { error: 'Missing or invalid owner' };
  }

  if (!obj.repo || typeof obj.repo !== 'string') {
    return { error: 'Missing or invalid repo' };
  }

  if (!obj.repoUrl || typeof obj.repoUrl !== 'string') {
    return { error: 'Missing or invalid repoUrl' };
  }

  if (!obj.filters) {
    return { error: 'Missing filters' };
  }

  return {
    patchNoteId,
    owner: obj.owner,
    repo: obj.repo,
    repoUrl: obj.repoUrl,
    branch: typeof obj.branch === 'string' ? obj.branch : undefined,
    filters: obj.filters as PatchNoteFilters,
    templateId: typeof obj.templateId === 'string' ? obj.templateId : undefined,
    cookieStore,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async ({ supabase, auth }) => {
    console.log("📥 Received process request");

    const { id } = await params;
    const body = await request.json();
    const cookieStore = await cookies();

    const { error: ownershipError } = await supabase
      .from("patch_notes")
      .select("id")
      .eq("id", id)
      .eq("owner_id", auth.user.id)
      .single();

    if (ownershipError) {
      return NextResponse.json({ error: "Patch note not found" }, { status: 404 });
    }

    const input = buildProcessInput(body, id, cookieStore);

    if ("error" in input) {
      return NextResponse.json({ error: input.error }, { status: 400 });
    }

    const result = await processPatchNote(input);

    return result.success
      ? NextResponse.json(result.data)
      : NextResponse.json({ error: result.error }, { status: 500 });
  });
}
