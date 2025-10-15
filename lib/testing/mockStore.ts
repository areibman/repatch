import { randomUUID } from "crypto";
import type { Database } from "@/lib/supabase/database.types";
import {
  samplePatchNotes,
  sampleSubscribers,
  initialGithubConfigs,
  type MockSubscriber,
  type MockGithubConfig,
} from "@/lib/__fixtures__/sample-data";

export type PatchNoteRow = Database["public"]["Tables"]["patch_notes"]["Row"];

type MockState = {
  patchNotes: PatchNoteRow[];
  subscribers: MockSubscriber[];
  githubConfigs: MockGithubConfig[];
};

const GLOBAL_KEY = Symbol.for("repatch.mock-state");

function createInitialState(): MockState {
  return {
    patchNotes: samplePatchNotes.map((note) => ({ ...note })),
    subscribers: sampleSubscribers.map((subscriber) => ({ ...subscriber })),
    githubConfigs: initialGithubConfigs.map((config) => ({ ...config })),
  };
}

function getState(): MockState {
  const globalAny = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MockState };
  if (!globalAny[GLOBAL_KEY]) {
    globalAny[GLOBAL_KEY] = createInitialState();
  }
  return globalAny[GLOBAL_KEY]!;
}

export function resetMockStore(): void {
  const globalAny = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MockState };
  globalAny[GLOBAL_KEY] = createInitialState();
}

export function listPatchNotes(): PatchNoteRow[] {
  return getState()
    .patchNotes.slice()
    .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime())
    .map((note) => ({ ...note }));
}

export function insertPatchNote(
  input: Omit<PatchNoteRow, "id" | "created_at" | "updated_at"> & Partial<PatchNoteRow>
): PatchNoteRow {
  const state = getState();
  const id = input.id ?? randomUUID();
  const now = new Date().toISOString();
  const note: PatchNoteRow = {
    id,
    repo_name: input.repo_name!,
    repo_url: input.repo_url!,
    time_period: input.time_period!,
    title: input.title ?? "Untitled",
    content: input.content ?? "",
    changes: input.changes ?? { added: 0, modified: 0, removed: 0 },
    contributors: input.contributors ?? [],
    generated_at: input.generated_at ?? now,
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? now,
    video_data: input.video_data ?? null,
    video_url: input.video_url ?? null,
    ai_overall_summary: input.ai_overall_summary ?? null,
    ai_summaries: input.ai_summaries ?? null,
  };
  state.patchNotes.push(note);
  return { ...note };
}

export function getPatchNoteById(id: string): PatchNoteRow | null {
  const note = getState().patchNotes.find((item) => item.id === id);
  return note ? { ...note } : null;
}

export function updatePatchNote(
  id: string,
  updates: Partial<PatchNoteRow>
): PatchNoteRow | null {
  const state = getState();
  const note = state.patchNotes.find((item) => item.id === id);
  if (!note) {
    return null;
  }
  Object.assign(note, updates, { updated_at: new Date().toISOString() });
  return { ...note };
}

export function deletePatchNote(id: string): boolean {
  const state = getState();
  const before = state.patchNotes.length;
  state.patchNotes = state.patchNotes.filter((item) => item.id !== id);
  return state.patchNotes.length < before;
}

export function listSubscribers() {
  return getState().subscribers.map((subscriber) => ({ ...subscriber }));
}

export function addSubscriber(email: string) {
  const state = getState();
  if (state.subscribers.some((subscriber) => subscriber.email === email)) {
    throw new Error("Email already subscribed");
  }
  const now = new Date().toISOString();
  const newSubscriber: MockSubscriber = {
    id: randomUUID(),
    email,
    unsubscribed: false,
    created_at: now,
    updated_at: now,
  };
  state.subscribers.push(newSubscriber);
  return { ...newSubscriber };
}

export function updateSubscriber(
  identifier: { id?: string; email?: string },
  updates: { unsubscribed?: boolean }
) {
  const state = getState();
  const subscriber = state.subscribers.find((item) =>
    identifier.id ? item.id === identifier.id : item.email === identifier.email
  );
  if (!subscriber) {
    return null;
  }
  if (updates.unsubscribed !== undefined) {
    subscriber.unsubscribed = updates.unsubscribed;
  }
  subscriber.updated_at = new Date().toISOString();
  return { ...subscriber };
}

export function removeSubscriber(identifier: { id?: string; email?: string }) {
  const state = getState();
  const before = state.subscribers.length;
  state.subscribers = state.subscribers.filter((item) =>
    identifier.id ? item.id !== identifier.id : item.email !== identifier.email
  );
  return state.subscribers.length < before;
}

export function upsertGithubConfig(payload: {
  repo_url: string;
  repo_owner: string | null;
  repo_name: string | null;
  access_token: string;
}): { id: string } {
  const state = getState();
  const existing = state.githubConfigs.find((config) => config.repo_url === payload.repo_url);
  const now = new Date().toISOString();
  if (existing) {
    existing.repo_owner = payload.repo_owner;
    existing.repo_name = payload.repo_name;
    existing.access_token = payload.access_token;
    existing.updated_at = now;
    return { id: existing.id };
  }
  const newConfig: MockGithubConfig = {
    id: randomUUID(),
    repo_url: payload.repo_url,
    repo_owner: payload.repo_owner,
    repo_name: payload.repo_name,
    access_token: payload.access_token,
    created_at: now,
    updated_at: now,
  };
  state.githubConfigs.push(newConfig);
  return { id: newConfig.id };
}

export function getGithubConfigByRepoUrl(repoUrl: string): MockGithubConfig | null {
  const config = getState().githubConfigs.find((item) => item.repo_url === repoUrl);
  return config ? { ...config } : null;
}

export function getActiveSubscriberEmails(): string[] {
  return getState()
    .subscribers.filter((subscriber) => !subscriber.unsubscribed)
    .map((subscriber) => subscriber.email);
}

export function recordVideoUrl(id: string, videoUrl: string) {
  const state = getState();
  const note = state.patchNotes.find((item) => item.id === id);
  if (note) {
    note.video_url = videoUrl;
    note.updated_at = new Date().toISOString();
  }
}

// Ensure the store is initialised when the module is loaded
resetMockStore();
