import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let cached: SupabaseClient<Database> | null = null;

export function createServiceClient(): SupabaseClient<Database> {
  if (!cached) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        "Missing Supabase configuration: ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set"
      );
    }

    cached = createClient<Database>(url, key, {
      auth: {
        persistSession: false,
      },
    });
  }

  return cached;
}
