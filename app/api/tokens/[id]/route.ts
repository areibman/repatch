import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withApiAuth } from "@/lib/api/with-auth";
import { logAudit } from "@/lib/logging";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return withApiAuth(async ({ supabase, auth }) => {
    const parsed = paramsSchema.safeParse({ id });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "A valid token ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("api_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", parsed.data.id)
      .eq("user_id", auth.user.id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to revoke API token" },
        { status: 500 }
      );
    }

    logAudit("token.revoked", {
      userId: auth.user.id,
      tokenId: parsed.data.id,
      usesTokenAuth: Boolean(auth.token),
    });

    return NextResponse.json({ success: true });
  });
}

