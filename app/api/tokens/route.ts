import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";

import { withApiAuth } from "@/lib/api/with-auth";
import { hashPersonalAccessToken } from "@/lib/auth";
import { logAudit } from "@/lib/logging";

const createTokenSchema = z.object({
  name: z.string().min(3).max(100),
  expiresAt: z.string().datetime().nullable().optional(),
  scopes: z.array(z.string().min(1)).max(20).optional(),
});

export async function GET() {
  return withApiAuth(async ({ supabase, auth }) => {
    const { data, error } = await supabase
      .from("api_tokens")
      .select(
        "id, name, token_prefix, scopes, expires_at, last_used_at, created_at, revoked_at"
      )
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load API tokens" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      (data || []).map((token) => ({
        id: token.id,
        name: token.name,
        prefix: token.token_prefix,
        scopes: token.scopes ?? [],
        expiresAt: token.expires_at,
        lastUsedAt: token.last_used_at,
        createdAt: token.created_at,
        revokedAt: token.revoked_at,
      }))
    );
  });
}

export async function POST(request: NextRequest) {
  return withApiAuth(async ({ supabase, auth }) => {
    const payload = createTokenSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.flatten() },
        { status: 400 }
      );
    }

    const tokenSecret = `rpt_${randomBytes(24).toString("hex")}`;
    const tokenHash = hashPersonalAccessToken(tokenSecret);
    const tokenPrefix = tokenSecret.slice(0, 8);
    const expiresAt = payload.data.expiresAt
      ? new Date(payload.data.expiresAt).toISOString()
      : null;

    const { data, error } = await supabase
      .from("api_tokens")
      .insert({
        name: payload.data.name.trim(),
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        scopes: payload.data.scopes ?? [],
        expires_at: expiresAt,
        user_id: auth.user.id,
      })
      .select(
        "id, name, token_prefix, scopes, expires_at, created_at, last_used_at"
      )
      .single();

    if (error || !data) {
      console.error("Failed to create API token:", error);
      return NextResponse.json(
        { error: "Failed to create API token" },
        { status: 500 }
      );
    }

    logAudit("token.created", {
      userId: auth.user.id,
      tokenId: data.id,
      scopes: data.scopes ?? [],
      usesTokenAuth: Boolean(auth.token),
    });

    return NextResponse.json(
      {
        token: tokenSecret,
        tokenId: data.id,
        name: data.name,
        prefix: data.token_prefix,
        scopes: data.scopes ?? [],
        expiresAt: data.expires_at,
        createdAt: data.created_at,
        lastUsedAt: data.last_used_at,
      },
      { status: 201 }
    );
  });
}

