import { createServiceSupabaseClient } from '@/lib/supabase';
import type { Json, Tables } from '@/lib/supabase/database.types';
import { z } from 'zod';
import type { AdminUserAttributes, User } from '@supabase/supabase-js';
import type { ManagedUser, UserListResponse, UserRole } from '@/types/user';

type UserProfileRow = Tables<'user_profiles'>;
type AuthUser = User & { banned_until?: string | null };

export class UserManagementError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = 'UserManagementError';
  }
}

const roleSchema = z.enum(['admin', 'editor', 'viewer']);

const jsonValueSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ])
);

const jsonObjectSchema = z.record(jsonValueSchema);

export const listUsersInputSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  query: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional(),
  includeInvited: z.coerce.boolean().default(true),
  includeBanned: z.coerce.boolean().default(true),
});

export type ListUsersInput = z.infer<typeof listUsersInputSchema>;

const baseCreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  fullName: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional(),
  avatarUrl: z.string().url().optional(),
  role: roleSchema.default('viewer'),
  metadata: jsonObjectSchema.optional(),
  preferences: jsonObjectSchema.optional(),
  invite: z.boolean().default(false),
  emailConfirmed: z.boolean().default(false),
  redirectTo: z.string().url().optional(),
});

export const createUserInputSchema = baseCreateUserSchema
  .refine(
    (value) => value.invite || typeof value.password === 'string',
    {
      message: 'Password is required when invite is false',
      path: ['password'],
    }
  )
  .refine(
    (value) => !value.invite || !value.emailConfirmed,
    {
      message: 'Invited users cannot be pre-confirmed',
      path: ['emailConfirmed'],
    }
  );

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = z
  .object({
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    fullName: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional(),
    avatarUrl: z.string().url().optional(),
    role: roleSchema.optional(),
    metadata: jsonObjectSchema.optional(),
    preferences: jsonObjectSchema.optional(),
    banDuration: z
      .union([
        z.literal('none'),
        z
          .string()
          .regex(
            /^(\d+(ns|us|µs|ms|s|m|h))+$/,
            'banDuration must include a numeric value followed by a supported unit (ns, us, µs, ms, s, m, h)'
          ),
      ])
      .optional(),
  })
  .refine(
    (value) =>
      Object.keys(value).some(
        (key) => typeof value[key as keyof typeof value] !== 'undefined'
      ),
    {
      message: 'At least one field must be provided to update a user',
    }
  );

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

export interface DeleteUserInput {
  soft: boolean;
}

export interface DeleteUserResult {
  deleted: boolean;
  soft: boolean;
}

type SupabaseServiceClient = ReturnType<typeof createServiceSupabaseClient>;

export async function listUsers(input: ListUsersInput): Promise<UserListResponse> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.auth.admin.listUsers({
    page: input.page,
    perPage: input.perPage,
  });

  if (error || !data) {
    throw new UserManagementError(
      error?.message ?? 'Failed to fetch users from Supabase',
      502
    );
  }

  const profiles = await fetchProfiles(supabase, data.users);
  const filteredUsers = applyUserFilters(data.users, profiles, input);
  const items = filteredUsers.map((user) =>
    mapUser(user as AuthUser, profiles.get(user.id) ?? null)
  );

  const total = typeof (data as { total?: number }).total === 'number'
    ? (data as { total: number }).total
    : data.users.length;
  const nextPage =
    typeof (data as { nextPage?: number | null }).nextPage === 'number'
      ? (data as { nextPage: number | null }).nextPage
      : null;
  const lastPage =
    typeof (data as { lastPage?: number }).lastPage === 'number'
      ? (data as { lastPage: number }).lastPage
      : Math.max(1, Math.ceil(total / input.perPage));

  return {
    items,
    pagination: {
      page: input.page,
      perPage: input.perPage,
      total,
      totalPages: lastPage,
      nextPage,
      hasMore: nextPage !== null,
    },
    filters: {
      query: input.query ?? null,
      includeInvited: input.includeInvited,
      includeBanned: input.includeBanned,
    },
  };
}

export async function getUser(id: string): Promise<ManagedUser> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.auth.admin.getUserById(id);

  if (error || !data.user) {
    throw new UserManagementError(
      error?.message ?? 'User not found',
      error?.status ?? 404
    );
  }

  const profile = await fetchProfileById(supabase, id);

  return mapUser(data.user as AuthUser, profile);
}

export async function createUser(input: CreateUserInput): Promise<ManagedUser> {
  const supabase = createServiceSupabaseClient();
  const metadataPayload = buildUserMetadata(input);

  if (input.invite) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(
      input.email,
      {
        data: metadataPayload,
        redirectTo: input.redirectTo,
      }
    );

    if (error || !data.user) {
      throw new UserManagementError(
        error?.message ?? 'Failed to invite user',
        error?.status ?? 502
      );
    }

    await upsertProfile(supabase, {
      id: data.user.id,
      email: input.email,
      fullName: input.fullName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      role: input.role,
      metadata: input.metadata ?? (data.user.user_metadata as Json) ?? null,
      preferences: input.preferences ?? null,
    });

    const profile = await fetchProfileById(supabase, data.user.id);
    return mapUser(data.user as AuthUser, profile);
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: input.emailConfirmed,
    user_metadata: metadataPayload,
  });

  if (error || !data.user) {
    throw new UserManagementError(
      error?.message ?? 'Failed to create user',
      error?.status ?? 502
    );
  }

  await upsertProfile(supabase, {
    id: data.user.id,
    email: input.email,
    fullName: input.fullName ?? null,
    avatarUrl: input.avatarUrl ?? null,
    role: input.role,
    metadata: input.metadata ?? (data.user.user_metadata as Json) ?? null,
    preferences: input.preferences ?? null,
  });

  const profile = await fetchProfileById(supabase, data.user.id);
  return mapUser(data.user as AuthUser, profile);
}

export async function updateUser(
  id: string,
  input: UpdateUserInput
): Promise<ManagedUser> {
  const supabase = createServiceSupabaseClient();

  const existing = await supabase.auth.admin.getUserById(id);

  if (existing.error || !existing.data.user) {
    throw new UserManagementError(
      existing.error?.message ?? 'User not found',
      existing.error?.status ?? 404
    );
  }

  const mergedMetadata = {
    ...(existing.data.user.user_metadata ?? {}),
  } as Record<string, Json>;

  if (typeof input.fullName !== 'undefined') {
    mergedMetadata.full_name = input.fullName;
  }
  if (typeof input.avatarUrl !== 'undefined') {
    mergedMetadata.avatar_url = input.avatarUrl;
  }
  if (typeof input.role !== 'undefined') {
    mergedMetadata.role = input.role;
  }
  if (typeof input.metadata !== 'undefined') {
    Object.assign(mergedMetadata, input.metadata ?? {});
  }

  const updatePayload: AdminUserAttributes = {};

  if (typeof input.email !== 'undefined') {
    updatePayload.email = input.email;
  }
  if (typeof input.password !== 'undefined') {
    updatePayload.password = input.password;
  }
  if (typeof input.banDuration !== 'undefined') {
    updatePayload.ban_duration = input.banDuration;
  }
  if (Object.keys(mergedMetadata).length > 0) {
    updatePayload.user_metadata = mergedMetadata;
  }

  const { data, error } = await supabase.auth.admin.updateUserById(
    id,
    updatePayload
  );

  if (error || !data.user) {
    throw new UserManagementError(
      error?.message ?? 'Failed to update user',
      error?.status ?? 502
    );
  }

  const profileBeforeUpdate = await fetchProfileById(supabase, id);

  await upsertProfile(supabase, {
    id,
    email: data.user.email ?? input.email ?? profileBeforeUpdate?.email ?? '',
    fullName:
      input.fullName ??
      profileBeforeUpdate?.full_name ??
      (data.user.user_metadata?.full_name as string | undefined) ??
      null,
    avatarUrl:
      input.avatarUrl ??
      profileBeforeUpdate?.avatar_url ??
      (data.user.user_metadata?.avatar_url as string | undefined) ??
      null,
    role: input.role ?? profileBeforeUpdate?.role ?? 'viewer',
    metadata:
      input.metadata ??
      profileBeforeUpdate?.metadata ??
      (data.user.user_metadata as Json) ??
      null,
    preferences: input.preferences ?? profileBeforeUpdate?.preferences ?? null,
  });

  const profile = await fetchProfileById(supabase, id);
  return mapUser(data.user as AuthUser, profile);
}

export async function deleteUser(
  id: string,
  options: DeleteUserInput
): Promise<DeleteUserResult> {
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase.auth.admin.deleteUser(id, options.soft);

  if (error) {
    throw new UserManagementError(
      error.message ?? 'Failed to delete user',
      error.status ?? 502
    );
  }

  // Best-effort cleanup (covers soft-deletes)
  await supabase.from('user_profiles').delete().eq('id', id);

  return {
    deleted: true,
    soft: options.soft,
  };
}

function buildUserMetadata(input: CreateUserInput): Record<string, Json> {
  const metadata: Record<string, Json> = {
    ...(input.metadata ?? {}),
    role: input.role,
  };

  if (input.fullName) {
    metadata.full_name = input.fullName;
  }

  if (input.avatarUrl) {
    metadata.avatar_url = input.avatarUrl;
  }

  return metadata;
}

async function fetchProfiles(
  client: SupabaseServiceClient,
  users: User[]
): Promise<Map<string, UserProfileRow>> {
  const ids = users.map((user) => user.id);

  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from('user_profiles')
    .select('*')
    .in('id', ids);

  if (error) {
    throw new UserManagementError(
      error.message ?? 'Failed to load user profiles',
      502
    );
  }

  return new Map(data.map((profile) => [profile.id, profile]));
}

async function fetchProfileById(
  client: SupabaseServiceClient,
  id: string
): Promise<UserProfileRow | null> {
  const { data, error } = await client
    .from('user_profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new UserManagementError(
      error.message ?? 'Failed to load user profile',
      502
    );
  }

  return data ?? null;
}

function applyUserFilters(
  users: User[],
  profiles: Map<string, UserProfileRow>,
  input: ListUsersInput
): User[] {
  return users.filter((user) => {
    const profile = profiles.get(user.id);
    if (!input.includeInvited && !user.email_confirmed_at) {
      return false;
    }

    const bannedUntil = (user as AuthUser).banned_until;
    if (!input.includeBanned && isUserBanned(bannedUntil)) {
      return false;
    }

    if (input.query) {
      const query = input.query.toLowerCase();
        const roleValue = profile?.role ?? '';
        const matches =
          (user.email ?? '').toLowerCase().includes(query) ||
          (profile?.full_name ?? '').toLowerCase().includes(query) ||
          roleValue.toLowerCase().includes(query);
      return matches;
    }

    return true;
  });
}

function isUserBanned(bannedUntil?: string | null): boolean {
  if (!bannedUntil) {
    return false;
  }

  return new Date(bannedUntil).getTime() > Date.now();
}

function mapUser(
  user: AuthUser,
  profile: UserProfileRow | null
): ManagedUser {
  const bannedUntil = user.banned_until ?? null;
  const isBanned = isUserBanned(bannedUntil);

  const status: ManagedUser['status'] = isBanned
    ? 'banned'
    : user.email_confirmed_at
      ? 'active'
      : 'invited';

  const role =
    (profile?.role ??
      (user.user_metadata?.role as UserRole | undefined) ??
      'viewer') as UserRole;

  return {
    id: user.id,
    email: user.email ?? '',
    fullName:
      profile?.full_name ??
      (user.user_metadata?.full_name as string | undefined) ??
      null,
    avatarUrl:
      profile?.avatar_url ??
      (user.user_metadata?.avatar_url as string | undefined) ??
      null,
    role,
    status,
    bannedUntil,
    createdAt: user.created_at,
    updatedAt: user.updated_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    metadata:
      profile?.metadata ??
      ((user.user_metadata as Json | undefined) ?? null),
    preferences: profile?.preferences ?? null,
    factors: (user.factors ?? []).map((factor) => factor.id),
    profile,
  };
}

async function upsertProfile(
  client: SupabaseServiceClient,
  payload: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
    role: UserRole;
    metadata: Json | null;
    preferences: Json | null;
  }
) {
  const { error } = await client.from('user_profiles').upsert(
    {
      id: payload.id,
      email: payload.email,
      full_name: payload.fullName,
      avatar_url: payload.avatarUrl,
      role: payload.role,
      metadata: payload.metadata,
      preferences: payload.preferences,
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw new UserManagementError(
      error.message ?? 'Failed to sync user profile metadata',
      502
    );
  }
}
