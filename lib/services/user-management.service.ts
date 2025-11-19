import { createServiceSupabaseClient } from "@/lib/supabase";
import type { Tables } from "@/lib/supabase/database.types";
import type { ServiceResult } from "./github-stats.service";
import type {
  ListUsersResponse,
  ManagedUserAccount,
  UserInvite,
  UserRole,
  UserProfile,
} from "@/types/user";
import type { User } from "@supabase/supabase-js";

type ProfileRow = Tables<"user_profiles">;
type InviteRow = Tables<"user_invites">;

const DEFAULT_PER_PAGE = 25;
const MAX_PER_PAGE = 100;

export interface ListUsersInput {
  page?: number;
  perPage?: number;
  search?: string;
  includeInvites?: boolean;
}

export interface InviteUserInput {
  email: string;
  role?: UserRole;
  fullName?: string;
  metadata?: Record<string, unknown>;
  redirectTo?: string;
  invitedBy?: string | null;
}

export interface UpdateUserInput {
  userId: string;
  role?: UserRole;
  fullName?: string | null;
  avatarUrl?: string | null;
  onboardingState?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface DeleteUserInput {
  userId: string;
}

export interface GetUserInput {
  userId: string;
}

export interface RevokeInviteInput {
  inviteId: string;
}

export function validateInviteUserPayload(
  payload: unknown
): ServiceResult<InviteUserInput> {
  if (!payload || typeof payload !== "object") {
    return { success: false, error: "Invalid payload" };
  }

  const body = payload as Record<string, unknown>;

  if (!body.email || typeof body.email !== "string") {
    return { success: false, error: "Email is required" };
  }

  const normalizedRole = normalizeRole(body.role);

  return {
    success: true,
    data: {
      email: body.email.trim().toLowerCase(),
      role: normalizedRole,
      fullName:
        typeof body.fullName === "string" ? body.fullName.trim() : undefined,
      metadata:
        typeof body.metadata === "object" && body.metadata !== null
          ? (body.metadata as Record<string, unknown>)
          : undefined,
      redirectTo:
        typeof body.redirectTo === "string" ? body.redirectTo : undefined,
      invitedBy:
        typeof body.invitedBy === "string" ? body.invitedBy : undefined,
    },
  };
}

export function validateUpdateUserPayload(
  payload: unknown
): ServiceResult<UpdateUserInput> {
  if (!payload || typeof payload !== "object") {
    return { success: false, error: "Invalid payload" };
  }

  const body = payload as Record<string, unknown>;

  if (!body.userId || typeof body.userId !== "string") {
    return { success: false, error: "userId is required" };
  }

  const update: UpdateUserInput = { userId: body.userId };

  if (body.role) {
    const normalizedRole = normalizeRole(body.role);
    if (!normalizedRole) {
      return { success: false, error: "role must be owner|admin|editor|viewer" };
    }
    update.role = normalizedRole;
  }

  if ("fullName" in body) {
    update.fullName =
      typeof body.fullName === "string" ? body.fullName : null;
  }

  if ("avatarUrl" in body) {
    update.avatarUrl =
      typeof body.avatarUrl === "string" || body.avatarUrl === null
        ? (body.avatarUrl as string | null)
        : null;
  }

  if ("onboardingState" in body && typeof body.onboardingState === "object") {
    update.onboardingState = body.onboardingState as Record<string, unknown>;
  }

  if ("preferences" in body && typeof body.preferences === "object") {
    update.preferences = body.preferences as Record<string, unknown>;
  }

  if ("email" in body) {
    if (typeof body.email !== "string" || !body.email.trim()) {
      return { success: false, error: "email must be a non-empty string" };
    }
    update.email = body.email.trim().toLowerCase();
  }

  if ("metadata" in body && typeof body.metadata === "object") {
    update.metadata = body.metadata as Record<string, unknown>;
  }

  return { success: true, data: update };
}

export function validateDeleteUserPayload(
  payload: unknown
): ServiceResult<DeleteUserInput> {
  if (!payload || typeof payload !== "object") {
    return { success: false, error: "Invalid payload" };
  }

  const body = payload as Record<string, unknown>;

  if (!body.userId || typeof body.userId !== "string") {
    return { success: false, error: "userId is required" };
  }

  return { success: true, data: { userId: body.userId } };
}

export async function listManagedUsers(
  input: ListUsersInput = {}
): Promise<ServiceResult<ListUsersResponse>> {
  try {
    const supabase = createServiceSupabaseClient();
    const page = clampNumber(input.page ?? 1, 1, Number.MAX_SAFE_INTEGER);
    const perPage = clampNumber(
      input.perPage ?? DEFAULT_PER_PAGE,
      1,
      MAX_PER_PAGE
    );
    const searchQuery =
      typeof input.search === "string" && input.search.trim().length > 0
        ? input.search.trim().toLowerCase()
        : null;

    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const authUsers = data?.users ?? [];
    const filteredUsers = searchQuery
        ? authUsers.filter((user) => doesUserMatchSearch(user, searchQuery))
      : authUsers;

    const profileIds = filteredUsers.map((user) => user.id);
    let profileRows: ProfileRow[] = [];

    if (profileIds.length > 0) {
      const { data: rows, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .in("id", profileIds);

      if (profileError) {
        throw profileError;
      }

      profileRows = rows ?? [];
    }

    const profileMap = new Map(profileRows.map((row) => [row.id, row]));
    const users: ManagedUserAccount[] = filteredUsers.map((user) =>
      buildManagedUserAccount(user, profileMap.get(user.id))
    );

    let invites: UserInvite[] = [];

    if (input.includeInvites ?? true) {
        const { data: inviteRows, error: inviteError } = await supabase
        .from("user_invites")
        .select("*")
          .order("created_at", { ascending: false });

      if (inviteError) {
        throw inviteError;
      }

      invites = (inviteRows ?? [])
        .filter((invite) =>
          searchQuery ? invite.email.toLowerCase().includes(searchQuery) : true
        )
        .map(mapInviteRow);
    }

    const nextPageToken =
      (data as { nextPage?: string | null })?.nextPage ?? null;
    const response: ListUsersResponse = {
      users,
      invites,
      pagination: {
        page,
        perPage,
        hasNextPage: Boolean(nextPageToken),
        nextPageToken,
      },
    };

    return { success: true, data: response };
  } catch (error) {
    return { success: false, error: formatUserServiceError(error) };
  }
}

export async function inviteUser(
  input: InviteUserInput
): Promise<ServiceResult<UserInvite>> {
  try {
    const supabase = createServiceSupabaseClient();
    const role = input.role ?? "viewer";
    const metadata = {
      ...input.metadata,
      full_name: input.fullName,
      role,
    };

    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      input.email,
      {
        data: metadata,
        redirectTo: input.redirectTo,
      }
    );

    if (inviteError) {
      throw inviteError;
    }

    const { data: inviteRow, error } = await supabase
      .from("user_invites")
      .upsert(
        {
          email: input.email,
          role,
          invited_by: input.invitedBy ?? null,
          metadata,
          status: "pending",
        },
        { onConflict: "email" }
      )
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data: mapInviteRow(inviteRow) };
  } catch (error) {
    return { success: false, error: formatUserServiceError(error) };
  }
}

export async function getManagedUser(
  input: GetUserInput
): Promise<ServiceResult<ManagedUserAccount>> {
  try {
    const supabase = createServiceSupabaseClient();

    const { data: authData, error: authError } =
      await supabase.auth.admin.getUserById(input.userId);

    if (authError || !authData?.user) {
      throw authError ?? new Error("User not found");
    }

    const { data: profileRow } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", input.userId)
      .maybeSingle();

    return {
      success: true,
      data: buildManagedUserAccount(authData.user, profileRow ?? undefined),
    };
  } catch (error) {
    return { success: false, error: formatUserServiceError(error) };
  }
}

export async function updateManagedUser(
  input: UpdateUserInput
): Promise<ServiceResult<ManagedUserAccount>> {
  try {
    const supabase = createServiceSupabaseClient();

    if (input.email || input.metadata) {
      const { error: authUpdateError } =
        await supabase.auth.admin.updateUserById(input.userId, {
          email: input.email,
          user_metadata: input.metadata,
        });

      if (authUpdateError) {
        throw authUpdateError;
      }
    }

    const profileUpdates = buildProfileUpdatePayload(input);

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update(profileUpdates)
        .eq("id", input.userId);

      if (profileError) {
        throw profileError;
      }
    }

    return await getManagedUser({ userId: input.userId });
  } catch (error) {
    return { success: false, error: formatUserServiceError(error) };
  }
}

export async function deleteManagedUser(
  input: DeleteUserInput
): Promise<ServiceResult<{ id: string }>> {
  try {
    const supabase = createServiceSupabaseClient();
    const { error } = await supabase.auth.admin.deleteUser(input.userId);

    if (error) {
      throw error;
    }

    return { success: true, data: { id: input.userId } };
  } catch (error) {
    return { success: false, error: formatUserServiceError(error) };
  }
}

export async function revokeInvite(
  input: RevokeInviteInput
): Promise<ServiceResult<UserInvite>> {
  try {
    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase
      .from("user_invites")
      .update({ status: "revoked" })
      .eq("id", input.inviteId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data: mapInviteRow(data) };
  } catch (error) {
    return { success: false, error: formatUserServiceError(error) };
  }
}

function buildManagedUserAccount(
  user: User,
  profileRow?: ProfileRow
): ManagedUserAccount {
  const profile = profileRow
    ? mapProfileRow(profileRow)
    : buildFallbackProfile(user);
  const factors = user.factors ?? [];
  const hasTotp = factors.some((factor) => factor.factor_type === "totp");
  const hasWebAuthn = factors.some((factor) => factor.factor_type === "webauthn");
  const status = user.banned_until
    ? "suspended"
    : user.email_confirmed_at
      ? "active"
      : "invited";

  return {
    ...profile,
    lastSignInAt: profile.lastSignInAt ?? user.last_sign_in_at ?? null,
    createdAt: profile.createdAt ?? user.created_at,
    updatedAt: profile.updatedAt ?? user.updated_at ?? user.created_at,
    emailConfirmed: Boolean(user.email_confirmed_at),
    phoneConfirmed: Boolean(user.phone_confirmed_at),
    mfaEnabled: factors.length > 0,
    status,
    factors: {
      totp: hasTotp || undefined,
      webAuthn: hasWebAuthn || undefined,
    },
  };
}

function buildFallbackProfile(user: User): UserProfile {
  const metadata =
    (user.user_metadata as Record<string, unknown> | undefined) ?? {};

  return {
    id: user.id,
    email: user.email ?? "",
    fullName:
      typeof metadata.full_name === "string"
        ? (metadata.full_name as string)
        : null,
    avatarUrl:
      typeof metadata.avatar_url === "string"
        ? (metadata.avatar_url as string)
        : null,
    role: normalizeRole(metadata.role) ?? "viewer",
    onboardingState:
      (metadata.onboarding_state as Record<string, unknown>) ?? {},
    preferences:
      (metadata.preferences as Record<string, unknown>) ??
      { newsletter_opt_in: true },
    lastSignInAt: user.last_sign_in_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at ?? user.created_at,
  };
}

function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    onboardingState: asRecord(row.onboarding_state),
    preferences: asRecord(row.preferences),
    lastSignInAt: row.last_sign_in_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInviteRow(row: InviteRow): UserInvite {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    invitedBy: row.invited_by,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: asRecord(row.metadata),
  };
}

function buildProfileUpdatePayload(input: UpdateUserInput) {
  const payload: Partial<Tables<"user_profiles">> = {};

  if (input.role) {
    payload.role = input.role;
  }
  if ("fullName" in input) {
    payload.full_name = input.fullName ?? null;
  }
  if ("avatarUrl" in input) {
    payload.avatar_url = input.avatarUrl ?? null;
  }
  if (input.onboardingState) {
    payload.onboarding_state = input.onboardingState;
  }
  if (input.preferences) {
    payload.preferences = input.preferences;
  }

  if (Object.keys(payload).length > 0) {
    payload.updated_at = new Date().toISOString();
  }

  return payload;
}

function doesUserMatchSearch(user: User, query: string): boolean {
  const emailMatch = user.email?.toLowerCase().includes(query);
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? (user.user_metadata.full_name as string)
      : "";
  const fullNameMatch = fullName.toLowerCase().includes(query);
  return Boolean(emailMatch || fullNameMatch);
}

function normalizeRole(role: unknown): UserRole | undefined {
  if (typeof role !== "string") {
    return undefined;
  }

  const normalized = role.toLowerCase() as UserRole;
  return ["owner", "admin", "editor", "viewer"].includes(normalized)
    ? normalized
    : undefined;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function formatUserServiceError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "An unexpected error occurred";
}
