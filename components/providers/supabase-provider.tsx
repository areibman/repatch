"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
} from "@supabase/supabase-js";

import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";

type SessionSyncEvent = AuthChangeEvent | "INITIAL_SESSION";

function logAuthEvent(message: string, details?: Record<string, unknown>) {
  const payload = details
    ? {
        ...details,
        timestamp: new Date().toISOString(),
      }
    : undefined;

  if (payload) {
    console.info("[supabase-auth] %s", message, payload);
    return;
  }

  console.info("[supabase-auth] %s", message);
}

interface SupabaseContextValue {
  supabase: SupabaseClient<Database>;
  session: Session | null;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextValue | undefined>(
  undefined
);

export function SupabaseProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncSessionWithServer = useCallback(
    async (event: SessionSyncEvent, nextSession: Session | null) => {
      if (event === "INITIAL_SESSION" && !nextSession) {
        logAuthEvent("Skipping INITIAL_SESSION sync; no session detected");
        return;
      }

      try {
        logAuthEvent("Syncing session with server", {
          event,
          hasSession: Boolean(nextSession),
          userId: nextSession?.user?.id,
          expiresAt: nextSession?.expires_at,
        });

        const response = await fetch("/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            event,
            session: nextSession,
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          console.error("[supabase-auth] Session sync failed", {
            status: response.status,
            body,
          });
        }
      } catch (error) {
        console.error(
          "[supabase-auth] Unexpected error while syncing session",
          error
        );
      }
    },
    []
  );

  const refreshSession = useCallback(async () => {
    logAuthEvent("Refreshing session from browser storage");
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("[supabase-auth] Failed to refresh session", error);
    }

    setSession(data.session);
    setIsLoading(false);

    if (data.session) {
      await syncSessionWithServer("INITIAL_SESSION", data.session);
    }
  }, [supabase, syncSessionWithServer]);

  useEffect(() => {
    void refreshSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, updatedSession) => {
      logAuthEvent("Auth state change detected", {
        event,
        userId: updatedSession?.user?.id,
        expiresAt: updatedSession?.expires_at,
      });
      setSession(updatedSession);
      setIsLoading(false);
      await syncSessionWithServer(event, updatedSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshSession, supabase, syncSessionWithServer]);

  const value = useMemo(
    () => ({
      supabase,
      session,
      isLoading,
      refreshSession,
    }),
    [supabase, session, isLoading, refreshSession]
  );

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }
  return context;
}

