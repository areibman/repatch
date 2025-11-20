/**
 * Supabase-backed user management utilities.
 * Mirrors the patterns documented in https://supabase.com/docs/guides/auth/admin/manage-users
 * so we stay aligned with official admin APIs.
 */

import { createServiceSupabaseClient } from '@/lib/supabase';
import {
  Constants,
  type Database,
  type TablesInsert,
  type TablesUpdate,
  type Json,
} from '@/lib/supabase/database.types';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { z } from 'zod';
import type { ManagedUser, UserProfileRow, UserRole, UserStatus } from '@/types/user';

const ROLE_VALUES = Constants.public.Enums.user_role_type as [UserRole, ...UserRole[]];
const STATUS_VALUES = Constants.public.Enums.user_status_type as [UserStatus, ...UserStatus[]];

const metadataSchema = z.record(z.string(), z.unknown()).optional().default({});

const baseProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  avatarUrl: z.string().url().optional(),
  role: z.enum(ROLE_VALUES).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  metadata: metadataSchema,
});

export const createUserSchema = baseProfileSchema
  .extend({
    email: z.string().email(),
    password: z.string().min(8).optional(),
    sendInvite: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (!value.sendInvite && !value.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password is required when sendInvite is false',
        path: ['password'],
      });
    }
  });

export const updateUserSchema = baseProfileSchema
  .extend({
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
  })
  .refine(
    (value) =>
      Boolean(
        value.email ??
          value.password ??
          value.fullName ??
          value.avatarUrl ??
          value.role ??
          value.status ??
          (value.metadata && Object.keys(value.metadata).length)
      ),
    {
      message: 'At least one field must be provided to update a user',
    }
  );

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  email: z.string().email().optional(),
  role: z.enum(ROLE_VALUES).optional(),
  status: z.enum(STATUS_VALUES).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export interface PaginatedUsers {
  users: ManagedUser[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
  };
}

export class UserManagementError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
    this.name = 'UserManagementError';
  }
}

const USER_PROFILE_TABLE = 'user_profiles';
const DEFAULT_ROLE: UserRole = 'viewer';
const DEFAULT_STATUS: UserStatus = 'invited';
const ACTIVE_STATUS: UserStatus = 'active';

export async function listManagedUsers(query: ListUsersQuery): Promise<PaginatedUsers> {
  const supabase = createServiceSupabaseClient();

  const { data, error } = await supabase.auth.admin.listUsers({
    page: query.page,
    perPage: query.perPage,
  });

  if (error) {
    console.error('[UserManagement] listUsers failed:', error.message);
    throw new UserManagementError('Failed to list users');
  }

  const users = data.users ?? [];
  const profiles = await fetchProfilesByIds(supabase, users.map((user) => user.id));
  const profileMap = new Map<string, UserProfileRow>();
  profiles.forEach((profile) => profileMap.set(profile.id, profile));

  let merged = users.map((user) => mergeUser(user, profileMap.get(user.id)));

  if (query.email) {
    const needle = query.email.toLowerCase();
    merged = merged.filter((user) => (user.email ?? '').toLowerCase().includes(needle));
  }

  if (query.role) {
    merged = merged.filter((user) => user.role === query.role);
  }

  if (query.status) {
    merged = merged.filter((user) => user.status === query.status);
  }

  const total =
    query.email || query.role || query.status
      ? merged.length
      : data.userCount ?? merged.length;

  return {
    users: merged,
    pagination: {
      page: query.page,
      perPage: query.perPage,
      total,
    },
  };
}

export async function getManagedUserById(id: string): Promise<ManagedUser> {
  const supabase = createServiceSupabaseClient();
  const user = await fetchUserById(supabase, id);
  const profile = await fetchProfileById(supabase, id);

  return mergeUser(user, profile ?? undefined);
}

export async function createManagedUser(input: CreateUserInput): Promise<ManagedUser> {
  const supabase = createServiceSupabaseClient();
  const metadata = input.metadata ?? {};
  const role = input.role ?? DEFAULT_ROLE;
  const status = input.status ?? (input.sendInvite ? DEFAULT_STATUS : ACTIVE_STATUS);

  const userMetadata = buildUserMetadata({
    fullName: input.fullName,
    avatarUrl: input.avatarUrl,
    metadata,
  });

  let user: User | null = null;

  if (input.sendInvite) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(input.email, {
      data: userMetadata,
      redirectTo: process.env.NEXT_PUBLIC_APP_URL,
    });

    if (error || !data?.user) {
      console.error('[UserManagement] invite failed:', error?.message);
      throw new UserManagementError(error?.message ?? 'Failed to invite user');
    }

    user = data.user;
  } else {
    const password = input.password;

    if (!password) {
      throw new UserManagementError('Password is required when sendInvite is false');
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: input.email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
      app_metadata: { role },
    });

    if (error || !data?.user) {
      console.error('[UserManagement] create failed:', error?.message);
      throw new UserManagementError(error?.message ?? 'Failed to create user');
    }

    user = data.user;
  }

  await upsertUserProfile(supabase, {
    id: user.id,
    email: user.email ?? input.email,
    full_name: input.fullName ?? null,
    avatar_url: input.avatarUrl ?? null,
    role,
    status,
    metadata: (metadata ?? {}) as Json,
    last_sign_in_at: user.last_sign_in_at,
  });

  return mergeUser(user, {
    id: user.id,
    email: user.email ?? input.email,
    full_name: input.fullName ?? null,
    avatar_url: input.avatarUrl ?? null,
    role,
    status,
    metadata: (metadata ?? {}) as Json,
    last_sign_in_at: user.last_sign_in_at,
    created_at: user.created_at,
    updated_at: user.updated_at ?? user.created_at,
  } as UserProfileRow);
}

export async function updateManagedUser(
  id: string,
  input: UpdateUserInput
): Promise<ManagedUser> {
  const supabase = createServiceSupabaseClient();
  const existingUser = await fetchUserById(supabase, id);
  const existingProfile = await fetchProfileById(supabase, id);

  const authUpdates: Parameters<
    SupabaseClient<Database>['auth']['admin']['updateUserById']
  >[1] = {};

  if (input.email) {
    authUpdates.email = input.email;
  }

  if (input.password) {
    authUpdates.password = input.password;
  }

  const nextUserMetadata = buildUserMetadata({
    fullName: input.fullName ?? existingProfile?.full_name ?? null,
    avatarUrl: input.avatarUrl ?? existingProfile?.avatar_url ?? null,
    metadata: {
      ...(existingProfile?.metadata as Record<string, unknown> | undefined),
      ...(input.metadata ?? {}),
    },
  });

  if (
    input.fullName !== undefined ||
    input.avatarUrl !== undefined ||
    (input.metadata && Object.keys(input.metadata).length)
  ) {
    authUpdates.user_metadata = {
      ...existingUser.user_metadata,
      ...nextUserMetadata,
    };
  }

  if (Object.keys(authUpdates).length > 0) {
    const { data, error } = await supabase.auth.admin.updateUserById(id, authUpdates);

    if (error || !data?.user) {
      console.error('[UserManagement] update failed:', error?.message);
      throw new UserManagementError(error?.message ?? 'Failed to update user');
    }
  }

  const profileUpdate: TablesUpdate<'user_profiles'> = {};

  if (input.email) {
    profileUpdate.email = input.email;
  }

  if (input.fullName !== undefined) {
    profileUpdate.full_name = input.fullName;
  }

  if (input.avatarUrl !== undefined) {
    profileUpdate.avatar_url = input.avatarUrl;
  }

  if (input.role) {
    profileUpdate.role = input.role;
  }

  if (input.status) {
    profileUpdate.status = input.status;
  }

  if (input.metadata) {
    profileUpdate.metadata = input.metadata as Json;
  }

  if (Object.keys(profileUpdate).length > 0) {
    if (existingProfile) {
      const { error } = await supabase
        .from(USER_PROFILE_TABLE)
        .update(profileUpdate)
        .eq('id', id);

      if (error) {
        console.error('[UserManagement] profile update failed:', error.message);
        throw new UserManagementError('Failed to update user profile');
      }
    } else {
      await upsertUserProfile(supabase, {
        id,
        email: input.email ?? existingUser.email ?? '',
        full_name: input.fullName ?? null,
        avatar_url: input.avatarUrl ?? null,
        role: input.role ?? DEFAULT_ROLE,
        status: input.status ?? DEFAULT_STATUS,
        metadata: (input.metadata ??
          (existingUser.user_metadata as Record<string, unknown> | undefined) ??
          {}) as Json,
        last_sign_in_at: existingUser.last_sign_in_at,
      });
    }
  }

  const refreshedUser = await fetchUserById(supabase, id);
  const refreshedProfile = await fetchProfileById(supabase, id);

  return mergeUser(refreshedUser, refreshedProfile ?? undefined);
}

export async function deleteManagedUser(id: string): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase.auth.admin.deleteUser(id);

  if (error) {
    console.error('[UserManagement] delete failed:', error.message);
    throw new UserManagementError('Failed to delete user');
  }
}

async function fetchProfilesByIds(
  supabase: SupabaseClient<Database>,
  ids: string[]
): Promise<UserProfileRow[]> {
  if (!ids.length) {
    return [];
  }

  const { data, error } = await supabase
    .from(USER_PROFILE_TABLE)
    .select('*')
    .in('id', ids);

  if (error) {
    console.error('[UserManagement] fetchProfiles failed:', error.message);
    throw new UserManagementError('Failed to load user profiles');
  }

  return data ?? [];
}

async function fetchProfileById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<UserProfileRow | null> {
  const { data, error } = await supabase
    .from(USER_PROFILE_TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[UserManagement] fetchProfileById failed:', error.message);
    throw new UserManagementError('Failed to load user profile');
  }

  return data ?? null;
}

async function fetchUserById(supabase: SupabaseClient<Database>, id: string): Promise<User> {
  const { data, error } = await supabase.auth.admin.getUserById(id);

  if (error || !data?.user) {
    throw new UserManagementError('User not found', 404);
  }

  return data.user;
}

async function upsertUserProfile(
  supabase: SupabaseClient<Database>,
  payload: TablesInsert<'user_profiles'>
): Promise<void> {
  const { error } = await supabase.from(USER_PROFILE_TABLE).upsert(payload, {
    onConflict: 'id',
  });

  if (error) {
    console.error('[UserManagement] upsertProfile failed:', error.message);
    throw new UserManagementError('Failed to persist user profile');
  }
}

function mergeUser(user: User, profile?: UserProfileRow): ManagedUser {
  return {
    id: user.id,
    email: user.email ?? profile?.email ?? null,
    role: profile?.role ?? (user.app_metadata?.role as UserRole | undefined) ?? DEFAULT_ROLE,
    status: profile?.status ?? DEFAULT_STATUS,
    fullName:
      profile?.full_name ??
      (user.user_metadata?.full_name as string | null | undefined) ??
      null,
    avatarUrl:
      profile?.avatar_url ??
      (user.user_metadata?.avatar_url as string | null | undefined) ??
      null,
    metadata: (profile?.metadata as Record<string, unknown> | undefined) ?? {},
    lastSignInAt: user.last_sign_in_at ?? profile?.last_sign_in_at ?? null,
    createdAt: user.created_at,
    updatedAt: profile?.updated_at ?? user.updated_at ?? user.created_at,
    factors: user.factors ?? [],
    provider: (user.app_metadata?.provider as string | undefined) ?? null,
  };
}

function buildUserMetadata({
  fullName,
  avatarUrl,
  metadata,
}: {
  fullName?: string | null;
  avatarUrl?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const payload: Record<string, unknown> = {
    ...metadata,
  };

  if (fullName !== undefined) {
    payload.full_name = fullName;
  }

  if (avatarUrl !== undefined) {
    payload.avatar_url = avatarUrl;
  }

  return payload;
}
