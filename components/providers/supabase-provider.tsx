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

interface SupabaseContextValue {
  supabase: SupabaseClient<Database>;
  session: Session | null;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextValue | undefined>(
  undefined
);

function isAuthSessionMissingError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "AuthSessionMissingError"
  );
}

export function SupabaseProvider({
  children,
  initialSession = null,
}: {
  children: ReactNode;
  initialSession?: Session | null;
}) {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [session, setSession] = useState<Session | null>(initialSession);
  const [isLoading, setIsLoading] = useState(false);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentSession = sessionData.session ?? null;

      if (!currentSession) {
        setSession(null);
        return;
      }

      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        if (error && !isAuthSessionMissingError(error)) {
          console.error("Failed to refresh session:", error);
        }
        setSession(null);
        return;
      }

      setSession(currentSession);
    } catch (error) {
      if (!isAuthSessionMissingError(error)) {
        console.error("Failed to refresh session:", error);
      }
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    setSession(initialSession ?? null);
  }, [initialSession]);

  useEffect(() => {
    if (!initialSession) {
      refreshSession();
    }
  }, [initialSession, refreshSession]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshSession();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshSession, supabase]);

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

