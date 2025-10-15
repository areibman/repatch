"use server";

import { createClient } from "@/lib/supabase/server";

export type SaveGitHubConfigInput = {
  repoUrl: string;
  accessToken: string;
};

export type SaveGitHubConfigResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type GitHubConfig = {
  id: string;
  repo_url: string;
  repo_owner: string | null;
  repo_name: string | null;
  created_at: string;
  updated_at: string;
};

const isMock = process.env.REPATCH_TEST_MODE === "mock";

export async function saveGitHubConfig(
  input: SaveGitHubConfigInput
): Promise<SaveGitHubConfigResult> {
  if (isMock) {
    const { upsertGithubConfig } = await import("@/lib/testing/mockStore");
    const url = input.repoUrl.trim();
    const match = url.match(/github\.com\/(.+?)\/(.+?)(?:\.git)?$/i);
    const repo_owner = match?.[1] ?? null;
    const repo_name = match?.[2] ?? null;

    if (!url) {
      return { ok: false, error: "Repository URL is required" };
    }
    if (!input.accessToken) {
      return { ok: false, error: "Access token is required" };
    }

    const result = upsertGithubConfig({
      repo_url: url,
      repo_owner,
      repo_name,
      access_token: input.accessToken,
    });
    return { ok: true, id: result.id };
  }

  const supabase = await createClient();

  const url = input.repoUrl.trim();
  const match = url.match(/github\.com\/(.+?)\/(.+?)(?:\.git)?$/i);
  const repo_owner = match?.[1] ?? null;
  const repo_name = match?.[2] ?? null;

  if (!url) {
    return { ok: false, error: "Repository URL is required" };
  }
  if (!input.accessToken) {
    return { ok: false, error: "Access token is required" };
  }

  const payload: import("@/lib/supabase/database.types").Database["public"]["Tables"]["github_configs"]["Insert"] =
    {
      repo_url: url,
      repo_owner,
      repo_name,
      access_token: input.accessToken,
    };

  const query = supabase.from("github_configs");
  const { data, error } = await (query as any)
    .upsert(payload, { onConflict: "repo_url" })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  const id = (data as { id: string }).id;
  return { ok: true, id };
}

export async function getGitHubConfigByRepoUrl(
  repoUrl: string
): Promise<GitHubConfig | null> {
  if (isMock) {
    const { getGithubConfigByRepoUrl } = await import("@/lib/testing/mockStore");
    const config = getGithubConfigByRepoUrl(repoUrl);
    if (!config) {
      return null;
    }
    return {
      id: config.id,
      repo_url: config.repo_url,
      repo_owner: config.repo_owner,
      repo_name: config.repo_name,
      created_at: config.created_at,
      updated_at: config.updated_at,
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("github_configs")
    .select("id, repo_url, repo_owner, repo_name, created_at, updated_at")
    .eq("repo_url", repoUrl)
    .maybeSingle();

  if (error) {
    return null;
  }
  return data as GitHubConfig | null;
}

export type GitHubActionState = { ok: boolean; id?: string; error?: string };

export async function saveGitHubConfigAction(
  _prevState: GitHubActionState,
  formData: FormData
): Promise<GitHubActionState> {
  const repoUrl = String(formData.get("repoUrl") || "");
  const accessToken = String(formData.get("accessToken") || "");
  const result = await saveGitHubConfig({ repoUrl, accessToken });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, id: result.id };
}
