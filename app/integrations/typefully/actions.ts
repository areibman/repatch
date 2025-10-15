"use server";

import { createClient } from "@/lib/supabase/server";

export type SaveTypefullyConfigInput = {
  apiKey: string;
  accountLabel?: string;
};

export type SaveTypefullyConfigResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function saveTypefullyConfig(
  input: SaveTypefullyConfigInput
): Promise<SaveTypefullyConfigResult> {
  if (!input.apiKey?.trim()) {
    return { ok: false, error: "API key is required" };
  }

  try {
    const supabase = await createClient();
    const payload: import("@/lib/supabase/database.types").Database["public"]["Tables"]["typefully_configs"]["Insert"] = {
      api_key: input.apiKey.trim(),
      account_label: input.accountLabel?.trim() || null,
    };

    const { data, error } = await (supabase.from("typefully_configs") as any)
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, id: (data as { id: string }).id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save config" };
  }
}
