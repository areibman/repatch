"use server";

import { createClient } from "@/lib/supabase/server";
import { getTypefullyConfig } from "@/lib/typefully";

export type SaveTypefullyConfigState =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function loadTypefullyConfig() {
  try {
    return await getTypefullyConfig();
  } catch (error) {
    console.error("Failed to load Typefully config", error);
    return null;
  }
}

export async function saveTypefullyConfigAction(
  _prevState: SaveTypefullyConfigState | undefined,
  formData: FormData
): Promise<SaveTypefullyConfigState> {
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const profileId = String(formData.get("profileId") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "").trim();

  if (!apiKey || !profileId) {
    return { ok: false, error: "API key and profile ID are required" };
  }

  const supabase = await createClient();

  const payload: import("@/lib/supabase/database.types").Database["public"]["Tables"]["typefully_configs"]["Insert"] = {
    slug: "default",
    api_key: apiKey,
    profile_id: profileId,
    display_name: displayName || null,
    team_id: teamId || null,
  };

  const { data, error } = await supabase
    .from("typefully_configs")
    .upsert(payload, { onConflict: "slug" })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save Typefully config" };
  }

  return { ok: true, id: data.id };
}
