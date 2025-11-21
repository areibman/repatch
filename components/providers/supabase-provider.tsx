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
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";
import { logAuthEvent } from "@/lib/logging";

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
  initialSession,
}: {
  children: ReactNode;
  initialSession?: Session | null;
}) {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [session, setSession] = useState<Session | null>(
    initialSession ?? null
  );
  const [isLoading, setIsLoading] = useState(initialSession === undefined);

  const performSessionRefresh = useCallback(
    async (reason: string) => {
      setIsLoading(true);
      logAuthEvent("session_refresh_requested", {
        reason,
      });

      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          logAuthEvent("session_refresh_failed", {
            reason,
            error: error.message,
          });
          throw error;
        }

        setSession(data.session);
        logAuthEvent("session_refresh_completed", {
          reason,
          hasSession: Boolean(data.session),
          userId: data.session?.user.id ?? null,
        });
      } catch (error) {
        console.error("Failed to refresh Supabase session", error);
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  const refreshSession = useCallback(
    () => performSessionRefresh("manual-refresh"),
    [performSessionRefresh]
  );

  useEffect(() => {
    if (initialSession === undefined) {
      performSessionRefresh("initial-load").catch((error) =>
        console.error("Initial Supabase session load failed", error)
      );
    } else {
      setIsLoading(false);
      logAuthEvent("session_hydrated_from_server", {
        hasSession: Boolean(initialSession),
        userId: initialSession?.user.id ?? null,
      });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      logAuthEvent("auth_state_changed", {
        event: _event,
        hasSession: Boolean(updatedSession),
        userId: updatedSession?.user.id ?? null,
      });
      setSession(updatedSession);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initialSession, performSessionRefresh, supabase]);

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

