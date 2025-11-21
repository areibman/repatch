"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useSupabase } from "@/components/providers/supabase-provider";

export function SupabaseListener() {
  const router = useRouter();
  const { supabase } = useSupabase();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login");
        return;
      }

      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  return null;
}


