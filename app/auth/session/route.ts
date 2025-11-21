import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase";

type SessionEvent = AuthChangeEvent | "INITIAL_SESSION";

interface SessionSyncPayload {
  event?: SessionEvent;
  session?: Session | null;
}

function logSessionEvent(message: string, details?: Record<string, unknown>) {
  const payload = details
    ? { ...details, timestamp: new Date().toISOString() }
    : undefined;

  if (payload) {
    console.info("[auth/session] %s", message, payload);
    return;
  }

  console.info("[auth/session] %s", message);
}

export async function POST(request: Request) {
  let payload: SessionSyncPayload;

  try {
    payload = (await request.json()) as SessionSyncPayload;
  } catch (error) {
    console.error("[auth/session] Failed to parse request body", error);
    return NextResponse.json(
      { error: "Invalid session payload" },
      { status: 400 }
    );
  }

  const { event, session } = payload;
  logSessionEvent("Received session sync request", {
    event,
    hasSession: Boolean(session),
    userId: session?.user?.id,
  });

  if (!event) {
    return NextResponse.json(
      { error: "Missing event in session payload" },
      { status: 400 }
    );
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    if (event === "SIGNED_OUT") {
      await supabase.auth.signOut();
      logSessionEvent("Cleared server session after SIGNED_OUT");
      return NextResponse.json({ status: "signed_out" });
    }

    if (!session) {
      logSessionEvent("No session provided for non-sign-out event", {
        event,
      });
      return NextResponse.json(
        { status: "noop", reason: "missing_session" },
        { status: 200 }
      );
    }

    const { error } = await supabase.auth.setSession(session);

    if (error) {
      console.error("[auth/session] Failed to persist session", {
        message: error.message,
        status: error.status,
      });
      return NextResponse.json(
        { error: "Failed to persist session" },
        { status: 500 }
      );
    }

    logSessionEvent("Session persisted on server", {
      event,
      userId: session.user.id,
      expiresAt: session.expires_at,
    });

    return NextResponse.json({ status: "synced" });
  } catch (error) {
    console.error("[auth/session] Unexpected error while persisting session", {
      error,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

