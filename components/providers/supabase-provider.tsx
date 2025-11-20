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

export function SupabaseProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    refreshSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      setSession(updatedSession);
      setIsLoading(false);
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

