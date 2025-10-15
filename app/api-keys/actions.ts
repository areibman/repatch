"use server";

import { revalidatePath } from "next/cache";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
} from "@/lib/api-keys/service";

export type ApiKeyFormState = {
  ok: boolean;
  token?: string;
  error?: string;
};

export async function fetchApiKeys() {
  return listApiKeys();
}

export async function createApiKeyAction(
  _prevState: ApiKeyFormState,
  formData: FormData
): Promise<ApiKeyFormState> {
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const rateRaw = String(formData.get("rateLimitPerMinute") || "").trim();
  const createdBy = String(formData.get("createdBy") || "").trim();

  if (!name) {
    return { ok: false, error: "Name is required" };
  }

  const rate = Number.parseInt(rateRaw, 10);
  const rateLimitPerMinute = Number.isFinite(rate) && rate > 0 ? rate : 60;

  const result = await createApiKey({
    name,
    description: description || null,
    rateLimitPerMinute,
    createdBy: createdBy || null,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  await revalidatePath("/api-keys");
  return { ok: true, token: result.token };
}

export async function rotateApiKeyAction(id: string) {
  const result = await rotateApiKey(id);
  if (!result.ok) {
    return result;
  }

  await revalidatePath("/api-keys");
  return result;
}

export async function revokeApiKeyAction(id: string) {
  const result = await revokeApiKey(id);
  if (!result.ok) {
    return result;
  }

  await revalidatePath("/api-keys");
  return result;
}
