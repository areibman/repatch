import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { withApiAuth } from "@/lib/api/with-auth";
import {
  summarizeCommits,
  validateSummarizeInput,
  renderVideo,
} from "@/lib/services";
import { logAudit } from "@/lib/logging";

export async function POST(request: NextRequest) {
  return withApiAuth(async ({ supabase, auth }) => {
    const body = await request.json();
    const tool = typeof body.tool === "string" ? body.tool : undefined;

    logAudit("mcp.tool_invoked", {
      userId: auth.user.id,
      tool: tool ?? "unknown",
      tokenId: auth.token?.id ?? null,
      scopes: auth.token?.scopes ?? [],
    });

    switch (tool) {
      case "summary.generate": {
        const cookieStore = await cookies();
        const validation = validateSummarizeInput(body.input, cookieStore);

        if (!validation.success) {
          return NextResponse.json(
            { error: validation.error },
            { status: 400 }
          );
        }

        const result = await summarizeCommits(validation.data);

        return result.success
          ? NextResponse.json(result.data)
          : NextResponse.json({ error: result.error }, { status: 500 });
      }
      case "video.render": {
        const patchNoteId =
          typeof body.input?.patchNoteId === "string"
            ? body.input.patchNoteId
            : null;

        if (!patchNoteId) {
          return NextResponse.json(
            { error: "patchNoteId is required" },
            { status: 400 }
          );
        }

        const { data, error } = await supabase
          .from("patch_notes")
          .select("id")
          .eq("id", patchNoteId)
          .eq("owner_id", auth.user.id)
          .single();

        if (error || !data) {
          return NextResponse.json(
            { error: "Patch note not found" },
            { status: 404 }
          );
        }

        const result = await renderVideo({ patchNoteId });

        return result.success
          ? NextResponse.json({
              success: true,
              renderId: result.data.renderId,
              bucketName: result.data.bucketName,
            })
          : NextResponse.json(
              { error: result.error ?? "Failed to start render" },
              { status: 500 }
            );
      }
      default:
        return NextResponse.json(
          { error: "Unsupported MCP tool" },
          { status: 400 }
        );
    }
  });
}

