"use server";

import { saveTypefullyConfig } from "@/lib/typefully";

export type SaveTypefullyConfigState = {
  ok: boolean;
  id?: string;
  error?: string;
};

export async function saveTypefullyConfigAction(
  _prevState: SaveTypefullyConfigState,
  formData: FormData
): Promise<SaveTypefullyConfigState> {
  const apiKey = String(formData.get("apiKey") || "").trim();
  const workspaceId = String(formData.get("workspaceId") || "").trim();
  const profileId = String(formData.get("profileId") || "").trim();
  const teamId = String(formData.get("teamId") || "").trim();
  const label = String(formData.get("label") || "").trim();

  const result = await saveTypefullyConfig({
    apiKey,
    workspaceId: workspaceId || undefined,
    profileId: profileId || undefined,
    teamId: teamId || undefined,
    label: label || undefined,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, id: result.id };
}
