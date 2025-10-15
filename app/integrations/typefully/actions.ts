"use server";

import {
  saveTypefullyConfig,
  SaveTypefullyConfigInput,
  SaveTypefullyConfigResult,
} from "@/lib/typefully";

export type TypefullyActionState = {
  ok: boolean;
  id?: string;
  error?: string;
};

export async function saveTypefullyConfigAction(
  _prev: TypefullyActionState,
  formData: FormData
): Promise<TypefullyActionState> {
  const profileId = String(formData.get("profileId") || "").trim();
  const apiKey = String(formData.get("apiKey") || "").trim();
  const workspaceIdValue = formData.get("workspaceId");
  const workspaceId = workspaceIdValue
    ? String(workspaceIdValue).trim() || undefined
    : undefined;

  const payload: SaveTypefullyConfigInput = {
    profileId,
    apiKey,
    workspaceId,
  };

  const result: SaveTypefullyConfigResult = await saveTypefullyConfig(payload);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, id: result.id };
}
