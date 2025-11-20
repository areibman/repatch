import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ForbiddenError,
  buildAuthContext,
  hashPersonalAccessToken,
  UnauthorizedError,
  type AuthContext,
} from "@/lib/auth";
import {
  createServerSupabaseClient,
  createServiceSupabaseClient,
  getUserOrThrow,
} from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";

type HandlerArgs = {
  supabase: SupabaseClient<Database>;
  auth: AuthContext;
};

type Handler = (args: HandlerArgs) => Promise<Response>;

type WithApiAuthOptions = {
  skipProfile?: boolean;
};

export async function withApiAuth(
  handler: Handler,
  options: WithApiAuthOptions = {}
): Promise<Response> {
  const headerList = await headers();
  const authorizationHeader = headerList.get("authorization");

  if (authorizationHeader) {
    const token = extractPersonalAccessToken(authorizationHeader);
    if (token) {
      const patResult = await resolvePersonalAccessToken(token);
      if (patResult) {
        return handler(patResult);
      }

      return NextResponse.json(
        { error: "Invalid or expired API token" },
        { status: 401 }
      );
    }
  }

  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);

  try {
    const auth = await getUserOrThrow(supabase, {
      skipProfile: options.skipProfile,
    });
    return await handler({ supabase, auth });
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof ForbiddenError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("API auth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function extractPersonalAccessToken(authorization: string | null) {
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token.startsWith("rpt_") ? token : null;
}

async function resolvePersonalAccessToken(
  token: string
): Promise<HandlerArgs | null> {
  try {
    const supabase = createServiceSupabaseClient();
    const tokenHash = hashPersonalAccessToken(token);
    const { data: record, error } = await supabase
      .from("api_tokens")
      .select(
        "id, user_id, scopes, token_prefix, expires_at, revoked_at"
      )
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (error || !record) {
      return null;
    }

    if (record.expires_at && new Date(record.expires_at) < new Date()) {
      return null;
    }

    const userId = record.user_id;
    if (!userId) {
      return null;
    }

    const { data: userResult, error: userError } =
      await supabase.auth.admin.getUserById(userId);

    if (userError || !userResult.user) {
      return null;
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const auth = buildAuthContext(userResult.user, profile ?? null);
    auth.token = {
      id: record.id,
      prefix: record.token_prefix,
      scopes: record.scopes ?? [],
    };

    await supabase
      .from("api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", record.id);

    return { supabase, auth };
  } catch (error) {
    console.error("Personal access token validation failed:", error);
    return null;
  }
}

