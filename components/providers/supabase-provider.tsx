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
import { logAudit } from "@/lib/logging";

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

  const executeSessionRefresh = useCallback(
    async (reason: "initial" | "manual") => {
      setIsLoading(true);
      logAudit("auth.session_refresh.start", { reason });

      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          logAudit("auth.session_refresh.error", {
            reason,
            message: error.message,
            status: error.status,
          });
          console.error("[SupabaseProvider] Failed to refresh session", error);
        } else {
          logAudit("auth.session_refresh.complete", {
            reason,
            hasSession: Boolean(data.session),
            userId: data.session?.user?.id ?? null,
          });
        }

        setSession(data.session);
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : String(caught);
        logAudit("auth.session_refresh.exception", { reason, message });
        console.error("[SupabaseProvider] Session refresh crashed", caught);
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  const refreshSession = useCallback(
    async () => executeSessionRefresh("manual"),
    [executeSessionRefresh]
  );

  useEffect(() => {
    executeSessionRefresh("initial");

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, updatedSession) => {
      logAudit("auth.session_state_change", {
        event,
        hasSession: Boolean(updatedSession),
        userId: updatedSession?.user?.id ?? null,
      });
      setSession(updatedSession);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [executeSessionRefresh, supabase]);

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

