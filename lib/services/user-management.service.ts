import { randomBytes } from 'crypto';

import { type User, type UserAttributes } from '@supabase/supabase-js';
import { z } from 'zod';

import {
  createServiceSupabaseClient,
  formatSupabaseConfigError,
  isSupabaseConfigError,
} from '@/lib/supabase';
import type { Json, Tables } from '@/lib/supabase/database.types';
import type {
  ManagedUser,
  UserListResult,
  UserProfileRow,
  UserRole,
} from '@/types/user-management';

const DEFAULT_PER_PAGE = 25;
const MAX_PER_PAGE = 100;

export const userRoleSchema = z.enum(['admin', 'editor', 'viewer']);

export const listUsersParamsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    perPage: z
      .coerce.number()
      .int()
      .min(1)
      .max(MAX_PER_PAGE)
      .default(DEFAULT_PER_PAGE),
    search: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    role: userRoleSchema.optional(),
    activeOnly: z.coerce.boolean().optional(),
  })
  .default({ page: 1, perPage: DEFAULT_PER_PAGE });

export const createUserPayloadSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(12)
    .max(72)
    .optional()
    .describe('Optional password; random strong password is generated when omitted'),
  fullName: z
    .string()
    .trim()
    .max(140)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  avatarUrl: z.string().url().optional(),
  role: userRoleSchema.optional().default('viewer'),
  metadata: z.record(z.unknown()).optional(),
});

export const updateUserPayloadSchema = z
  .object({
    email: z.string().email().optional(),
    password: z.string().min(12).max(72).optional(),
    fullName: z
      .string()
      .trim()
      .max(140)
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    avatarUrl: z.string().url().optional(),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine(
    (payload) =>
      Boolean(
        payload.email ??
          payload.password ??
          payload.fullName ??
          payload.avatarUrl ??
          payload.role ??
          payload.metadata ??
          typeof payload.isActive === 'boolean'
      ),
    {
      message: 'Provide at least one field to update',
      path: [],
    }
  );

export class UserManagementError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'UserManagementError';
  }
}

function getSupabaseServiceClient() {
  try {
    return createServiceSupabaseClient();
  } catch (error) {
    if (isSupabaseConfigError(error)) {
      throw new UserManagementError(
        'Invalid Supabase configuration for service client',
        500,
        formatSupabaseConfigError(error)
      );
    }

    throw new UserManagementError(
      'Failed to initialize Supabase service client',
      500,
      error
    );
  }
}

function mapToManagedUser(
  user: User,
  profile?: UserProfileRow | null
): ManagedUser {
  return {
    id: user.id,
    email: user.email ?? profile?.email ?? '',
    role: (profile?.role ?? 'viewer') as UserRole,
    isActive: profile?.is_active ?? true,
    fullName:
      profile?.full_name ??
      (typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : null),
    avatarUrl:
      profile?.avatar_url ??
      (typeof user.user_metadata?.avatar_url === 'string'
        ? user.user_metadata.avatar_url
        : null),
    metadata:
      (profile?.metadata as Json) ??
      (user.user_metadata as Json) ??
      ({} as Json),
    lastSignInAt: user.last_sign_in_at ?? profile?.last_sign_in_at ?? null,
    createdAt: profile?.created_at ?? user.created_at ?? null,
    updatedAt: profile?.updated_at ?? user.updated_at ?? user.created_at ?? null,
  };
}

function toJsonMetadata(value?: Record<string, unknown>): Json {
  if (!value) return {} as Json;
  return value as Json;
}

function generateRandomPassword(): string {
  return randomBytes(32).toString('base64url');
}

async function upsertUserProfile(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  payload: Tables<'user_profiles'>
) {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    throw new UserManagementError('Failed to upsert user profile', 502, error);
  }

  return data;
}

export async function listManagedUsers(
  rawParams?: unknown
): Promise<UserListResult> {
  const params = listUsersParamsSchema.parse(rawParams ?? {});
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase.auth.admin.listUsers({
    page: params.page,
    perPage: params.perPage,
  });

  if (error || !data) {
    throw new UserManagementError('Failed to list Supabase users', 502, error);
  }

  const ids = data.users?.map((user) => user.id) ?? [];
  const profiles =
    ids.length > 0
      ? await supabase
          .from('user_profiles')
          .select('*')
          .in('id', ids)
      : { data: [], error: null };

  if (profiles.error) {
    throw new UserManagementError(
      'Failed to fetch user profiles',
      502,
      profiles.error
    );
  }

  const profileMap = new Map<string, UserProfileRow>();
  profiles.data?.forEach((row) => profileMap.set(row.id, row));

  let users =
    data.users?.map((user) => mapToManagedUser(user, profileMap.get(user.id))) ??
    [];

  if (params.search) {
    const query = params.search.toLowerCase();
    users = users.filter((user) => {
      const emailMatch = user.email?.toLowerCase().includes(query);
      const nameMatch = user.fullName?.toLowerCase().includes(query);
      return Boolean(emailMatch || nameMatch);
    });
  }

  if (params.role) {
    users = users.filter((user) => user.role === params.role);
  }

  if (params.activeOnly) {
    users = users.filter((user) => user.isActive);
  }

  return {
    users,
    pagination: {
      page: data.page ?? params.page,
      perPage: data.perPage ?? params.perPage,
      total: data.total ?? users.length,
      nextPage: data.nextPage ?? null,
      lastPage: data.lastPage ?? null,
    },
  };
}

export async function getManagedUserById(userId: string): Promise<ManagedUser> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error || !data.user) {
    throw new UserManagementError('User not found', 404, error);
  }

  const profile = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profile.error) {
    throw new UserManagementError(
      'Failed to load user profile',
      502,
      profile.error
    );
  }

  return mapToManagedUser(data.user, profile.data);
}

export async function createManagedUser(rawPayload: unknown) {
  const payload = createUserPayloadSchema.parse(rawPayload);
  const supabase = getSupabaseServiceClient();
  const password = payload.password ?? generateRandomPassword();

  const authMetadata: Record<string, unknown> = {
    role: payload.role,
    ...(payload.fullName ? { full_name: payload.fullName } : {}),
    ...(payload.avatarUrl ? { avatar_url: payload.avatarUrl } : {}),
    ...(payload.metadata ?? {}),
  };

  const { data, error } = await supabase.auth.admin.createUser({
    email: payload.email,
    password,
    email_confirm: true,
    user_metadata: authMetadata,
  });

  if (error || !data.user) {
    throw new UserManagementError(
      'Failed to create Supabase user',
      502,
      error
    );
  }

  try {
    const profileRow: Tables<'user_profiles'> = {
      id: data.user.id,
      email: payload.email,
      full_name: payload.fullName ?? null,
      avatar_url: payload.avatarUrl ?? null,
      role: payload.role ?? 'viewer',
      is_active: true,
      metadata: toJsonMetadata(payload.metadata),
      last_sign_in_at: data.user.last_sign_in_at ?? null,
      created_at: data.user.created_at ?? new Date().toISOString(),
      updated_at: data.user.created_at ?? new Date().toISOString(),
    };

    const profile = await upsertUserProfile(supabase, profileRow);

    return {
      user: mapToManagedUser(data.user, profile),
      temporaryPassword: payload.password ? undefined : password,
    };
  } catch (profileError) {
    // Clean up the auth user to avoid orphaned accounts
    await supabase.auth.admin.deleteUser(data.user.id);
    throw profileError;
  }
}

export async function updateManagedUser(
  userId: string,
  rawPayload: unknown
): Promise<ManagedUser> {
  const payload = updateUserPayloadSchema.parse(rawPayload);
  const supabase = getSupabaseServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authUpdates: any = {};

  if (payload.email) {
    authUpdates.email = payload.email;
  }

  if (payload.password) {
    authUpdates.password = payload.password;
  }

  if (payload.fullName || payload.avatarUrl || payload.metadata) {
    authUpdates.user_metadata = {
      ...(payload.fullName ? { full_name: payload.fullName } : {}),
      ...(payload.avatarUrl ? { avatar_url: payload.avatarUrl } : {}),
      ...(payload.metadata ?? {}),
    };
  }

  const { data, error } = Object.keys(authUpdates).length
    ? await supabase.auth.admin.updateUserById(userId, authUpdates)
    : await supabase.auth.admin.getUserById(userId);

  if (error || !data.user) {
    throw new UserManagementError(
      'Failed to update Supabase user',
      error?.status ?? 502,
      error
    );
  }

  const profilePayload: Partial<Tables<'user_profiles'>> = {};

  if (payload.email) {
    profilePayload.email = payload.email;
  }

  if (payload.fullName !== undefined) {
    profilePayload.full_name = payload.fullName ?? null;
  }

  if (payload.avatarUrl !== undefined) {
    profilePayload.avatar_url = payload.avatarUrl ?? null;
  }

  if (payload.role) {
    profilePayload.role = payload.role;
  }

  if (payload.metadata) {
    profilePayload.metadata = toJsonMetadata(payload.metadata);
  }

  if (typeof payload.isActive === 'boolean') {
    profilePayload.is_active = payload.isActive;
  }

  let profile: UserProfileRow | null = null;

  if (Object.keys(profilePayload).length > 0) {
    profilePayload.updated_at = new Date().toISOString();

    const { data: updatedProfile, error: profileError } = await supabase
      .from('user_profiles')
      .update(profilePayload)
      .eq('id', userId)
      .select('*')
      .maybeSingle();

    if (profileError) {
      throw new UserManagementError(
        'Failed to update user profile',
        502,
        profileError
      );
    }

    profile = updatedProfile;
  } else {
    const { data: existing, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      throw new UserManagementError(
        'Failed to load user profile',
        502,
        profileError
      );
    }

    profile = existing;
  }

  return mapToManagedUser(data.user, profile);
}

export async function deleteManagedUser(userId: string) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    throw new UserManagementError('Failed to delete Supabase user', 502, error);
  }

  return { deleted: true, id: userId };
}

