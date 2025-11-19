import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServiceSupabaseClient, type Database } from "@/lib/supabase";
import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import {
  USER_ROLES,
  type InviteUserPayload,
  type UpdateUserPayload,
  type UserAccount,
  type UserRole,
  type UserStatus,
} from "@/types/user";

const ROLE_SET = new Set<UserRole>(USER_ROLES);
const DEFAULT_ROLE: UserRole = "member";

export interface ListUsersParams {
  page?: number;
  perPage?: number;
}

export interface ListUsersResult {
  users: UserAccount[];
  page: number;
  perPage: number;
  hasMore: boolean;
}

export async function listManagedUsers(params: ListUsersParams = {}): Promise<ListUsersResult> {
  const page = params.page && params.page > 0 ? params.page : 1;
  const perPage =
    params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 50;

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
  if (error) {
    throw error;
  }

  const users = data?.users ?? [];
  const profileMap = await fetchProfilesMap(supabase, users.map((user) => user.id));
  const normalized = users.map((user) => mapUser(user, profileMap.get(user.id)));
  const hasMore = users.length === perPage;

  return {
    users: normalized,
    page,
    perPage,
    hasMore,
  };
}

export async function inviteManagedUser(payload: InviteUserPayload): Promise<UserAccount> {
  const supabase = createServiceSupabaseClient();
  const role = normalizeRole(payload.role);

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(payload.email, {
    data: {
      full_name: payload.fullName,
      role,
    },
  });

  if (error) {
    throw error;
  }

  const user = data?.user;
  if (!user) {
    throw new Error("Supabase did not return the invited user record.");
  }

  const profile = await syncProfile(supabase, user, {
    email: payload.email,
    full_name: payload.fullName,
    role,
  });

  return mapUser(user, profile);
}

export async function updateManagedUser(
  userId: string,
  updates: UpdateUserPayload
): Promise<UserAccount> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const supabase = createServiceSupabaseClient();
  const normalizedRole = normalizeRole(updates.role);

  const metadata: Record<string, unknown> = {};
  let shouldUpdateMetadata = false;

  if (typeof updates.fullName !== "undefined") {
    metadata.full_name = updates.fullName;
    shouldUpdateMetadata = true;
  }

  if (typeof updates.avatarUrl !== "undefined") {
    metadata.avatar_url = updates.avatarUrl;
    shouldUpdateMetadata = true;
  }

  if (typeof updates.role !== "undefined") {
    metadata.role = normalizedRole;
    shouldUpdateMetadata = true;
  }

  const attributes: Parameters<
    SupabaseClient<Database>["auth"]["admin"]["updateUserById"]
  >[1] = {};

  if (shouldUpdateMetadata) {
    attributes.user_metadata = metadata;
  }

  if (updates.status === "disabled") {
    attributes.ban_duration = "forever";
  } else if (updates.status === "active") {
    attributes.ban_duration = "none";
  }

  if (!attributes.user_metadata && !attributes.ban_duration) {
    throw new Error("No valid updates provided");
  }

  const { data, error } = await supabase.auth.admin.updateUserById(userId, attributes);
  if (error) {
    throw error;
  }

  const user = data?.user;
  if (!user) {
    throw new Error("Supabase did not return the updated user record.");
  }

  const profile = await syncProfile(supabase, user, {
    role: typeof updates.role !== "undefined" ? normalizedRole : undefined,
    full_name: updates.fullName,
    avatar_url: updates.avatarUrl,
  });

  return mapUser(user, profile);
}

export async function deleteManagedUser(userId: string): Promise<void> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const supabase = createServiceSupabaseClient();
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    throw error;
  }
}

function normalizeRole(role?: UserRole | string | null): UserRole {
  if (role && ROLE_SET.has(role as UserRole)) {
    return role as UserRole;
  }
  return DEFAULT_ROLE;
}

async function fetchProfilesMap(
  supabase: SupabaseClient<Database>,
  ids: string[]
): Promise<Map<string, Tables<"profiles">>> {
  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.from("profiles").select("*").in("id", ids);
  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((profile) => [profile.id, profile]));
}

async function syncProfile(
  supabase: SupabaseClient<Database>,
  user: User,
  overrides: Partial<TablesInsert<"profiles">> = {}
): Promise<Tables<"profiles">> {
  const payload: TablesInsert<"profiles"> = {
    id: user.id,
    email: overrides.email ?? user.email ?? "",
    full_name:
      overrides.full_name ??
      (typeof user.user_metadata?.full_name === "string"
        ? (user.user_metadata.full_name as string)
        : null),
    avatar_url:
      overrides.avatar_url ??
      (typeof user.user_metadata?.avatar_url === "string"
        ? (user.user_metadata.avatar_url as string)
        : null),
    role:
      overrides.role ??
      normalizeRole(
        typeof user.user_metadata?.role === "string"
          ? (user.user_metadata.role as string)
          : null
      ),
    last_sign_in_at: overrides.last_sign_in_at ?? user.last_sign_in_at ?? null,
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function mapUser(user: User, profile?: Tables<"profiles">): UserAccount {
  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    fullName:
      profile?.full_name ??
      (typeof user.user_metadata?.full_name === "string"
        ? (user.user_metadata.full_name as string)
        : null),
    avatarUrl:
      profile?.avatar_url ??
      (typeof user.user_metadata?.avatar_url === "string"
        ? (user.user_metadata.avatar_url as string)
        : null),
    role:
      profile?.role ??
      normalizeRole(
        typeof user.user_metadata?.role === "string"
          ? (user.user_metadata.role as string)
          : null
      ),
    status: deriveStatus(user),
    lastSignInAt: profile?.last_sign_in_at ?? user.last_sign_in_at ?? null,
    createdAt: user.created_at,
    updatedAt: profile?.updated_at ?? user.updated_at ?? user.created_at,
    invitedAt: (user as Partial<User> & { invited_at?: string }).invited_at ?? null,
    factorsCount: Array.isArray((user as Partial<User> & { factors?: unknown }).factors)
      ? ((user as Partial<User> & { factors?: { factor_type: string }[] }).factors ?? [])
          .length
      : 0,
  };
}

function deriveStatus(user: User): UserStatus {
  if ((user as Partial<User> & { banned_until?: string | null }).banned_until) {
    return "disabled";
  }

  if (user.email_confirmed_at || user.confirmed_at || user.last_sign_in_at) {
    return "active";
  }

  if ((user as Partial<User> & { invited_at?: string | null }).invited_at) {
    return "invited";
  }

  return "unknown";
}
