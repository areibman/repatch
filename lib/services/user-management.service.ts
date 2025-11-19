import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createServiceSupabaseClient,
  type Database,
} from '@/lib/supabase';
import type {
  CreateTokenInput,
  CreateTokenResult,
  CreateUserInput,
  CreateUserResult,
  ListUsersFilters,
  UpdateUserInput,
  UserApiTokenRow,
  UserApiTokenSummary,
  UserDetail,
  UserListResult,
  UserProfileRow,
  UserRole,
  UserSummary,
} from '@/types/user';

type ServiceSuccess<T> = { success: true; data: T };
type ServiceFailure = { success: false; error: string; status?: number };
export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;
const PRIVILEGED_ROLES: UserRole[] = ['admin', 'manager'];

function getServiceClient(): SupabaseClient<Database> {
  return createServiceSupabaseClient();
}

function mapProfile(row: UserProfileRow): UserSummary {
  return {
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    metadata: row.metadata,
    lastSignInAt: row.last_sign_in_at,
    emailConfirmedAt: row.email_confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapToken(row: UserApiTokenRow): UserApiTokenSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

async function ensureActorAuthorization(
  supabase: SupabaseClient<Database>,
  actorId: string
): Promise<ServiceResult<UserRole>> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', actorId)
    .maybeSingle();

  if (error) {
    console.error('[user-service] Failed to resolve actor profile', error);
    return { success: false, error: 'Unable to resolve current user', status: 500 };
  }

  if (!data) {
    return { success: false, error: 'Actor profile not found', status: 403 };
  }

  if (!PRIVILEGED_ROLES.includes(data.role)) {
    return { success: false, error: 'Insufficient permissions', status: 403 };
  }

  return { success: true, data: data.role };
}

async function logAuditEvent(
  supabase: SupabaseClient<Database>,
  params: {
    actorId?: string | null;
    userId: string;
    action: string;
    previous?: Record<string, unknown> | null;
    next?: Record<string, unknown> | null;
    reason?: string;
  }
): Promise<void> {
  const { error } = await supabase.from('user_audit_logs').insert({
    actor_id: params.actorId ?? null,
    user_id: params.userId,
    action: params.action,
    previous_values: params.previous ?? null,
    new_values: params.next ?? null,
    reason: params.reason ?? null,
  });

  if (error) {
    console.warn('[user-service] Failed to log audit event', error);
  }
}

export async function listUsers(
  actorId: string,
  filters: ListUsersFilters = {}
): Promise<ServiceResult<UserListResult>> {
  const supabase = getServiceClient();
  const authz = await ensureActorAuthorization(supabase, actorId);
  if (!authz.success) return authz;

  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(filters.offset ?? 0, 0);

  let query = supabase
    .from('user_profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.roles?.length) {
    query = query.in('role', filters.roles);
  }

  if (filters.statuses?.length) {
    query = query.in('status', filters.statuses);
  }

  if (filters.search) {
    const escaped = filters.search.replace(/,/g, '\\,');
    query = query.or(
      `email.ilike.%${escaped}%,full_name.ilike.%${escaped}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[user-service] Failed to list users', error);
    return { success: false, error: 'Failed to list users', status: 500 };
  }

  return {
    success: true,
    data: {
      data: data.map(mapProfile),
      total: count ?? data.length,
      limit,
      offset,
    },
  };
}

export async function getUser(
  actorId: string,
  userId: string
): Promise<ServiceResult<UserDetail>> {
  const supabase = getServiceClient();
  const authz = await ensureActorAuthorization(supabase, actorId);
  if (!authz.success) return authz;

  const [{ data: profile, error: profileError }, { data: tokens, error: tokenError }] =
    await Promise.all([
      supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase
        .from('user_api_tokens')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

  if (profileError) {
    console.error('[user-service] Failed to fetch user profile', profileError);
    return { success: false, error: 'Unable to load user', status: 500 };
  }

  if (!profile) {
    return { success: false, error: 'User not found', status: 404 };
  }

  if (tokenError) {
    console.error('[user-service] Failed to fetch api tokens', tokenError);
    return { success: false, error: 'Unable to load user tokens', status: 500 };
  }

  return {
    success: true,
    data: {
      ...mapProfile(profile),
      tokens: (tokens ?? []).map(mapToken),
    },
  };
}

export async function createUser(
  actorId: string,
  input: CreateUserInput
): Promise<ServiceResult<CreateUserResult>> {
  const supabase = getServiceClient();
  const authz = await ensureActorAuthorization(supabase, actorId);
  if (!authz.success) return authz;

  const generatedPassword =
    input.password ??
    randomBytes(12).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 16);

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: generatedPassword,
    email_confirm: input.status === 'active' && input.sendWelcomeEmail !== false,
    user_metadata: {
      full_name: input.fullName,
      avatar_url: input.avatarUrl,
      role: input.role ?? 'viewer',
      ...(input.metadata ?? {}),
    },
  });

  if (authError || !authUser.user) {
    console.error('[user-service] Supabase auth createUser failed', authError);
    return {
      success: false,
      error: authError?.message ?? 'Failed to create Supabase auth user',
      status: 400,
    };
  }

  const userId = authUser.user.id;

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .update({
      role: input.role ?? 'viewer',
      status: input.status ?? (authUser.user.confirmed_at ? 'active' : 'invited'),
      full_name: input.fullName ?? authUser.user.user_metadata.full_name ?? null,
      avatar_url: input.avatarUrl ?? authUser.user.user_metadata.avatar_url ?? null,
      metadata: input.metadata ?? authUser.user.user_metadata ?? {},
      email: input.email,
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !profile) {
    console.error('[user-service] Failed to update user profile post create', error);
    return { success: false, error: 'Failed to finalize user creation', status: 500 };
  }

  await logAuditEvent(supabase, {
    actorId,
    userId,
    action: 'user.created',
    next: {
      role: profile.role,
      status: profile.status,
    },
  });

  return {
    success: true,
    data: {
      user: mapProfile(profile),
      temporaryPassword: input.password ? undefined : generatedPassword,
    },
  };
}

export async function updateUser(
  actorId: string,
  userId: string,
  input: UpdateUserInput
): Promise<ServiceResult<UserSummary>> {
  const supabase = getServiceClient();
  const authz = await ensureActorAuthorization(supabase, actorId);
  if (!authz.success) return authz;

  const { data: current, error: currentError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (currentError) {
    console.error('[user-service] Failed to load user profile for update', currentError);
    return { success: false, error: 'Unable to load user', status: 500 };
  }

  if (!current) {
    return { success: false, error: 'User not found', status: 404 };
  }

  const updates: Record<string, unknown> = {};

  if (input.email !== undefined) updates.email = input.email;
  if (input.fullName !== undefined) updates.full_name = input.fullName;
  if (input.avatarUrl !== undefined) updates.avatar_url = input.avatarUrl;
  if (input.role) updates.role = input.role;
  if (input.status) updates.status = input.status;
  if (input.metadata) updates.metadata = input.metadata;

  const shouldUpdateAuth =
    input.email !== undefined ||
    input.fullName !== undefined ||
    input.avatarUrl !== undefined ||
    input.metadata !== undefined ||
    input.status !== undefined;

  if (shouldUpdateAuth) {
    const banDuration =
      input.status === 'suspended' || input.status === 'deactivated'
        ? '8760h'
        : 'none';

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(userId, {
      email: input.email,
      user_metadata: {
        ...(current.metadata ?? {}),
        ...(input.metadata ?? {}),
        full_name: input.fullName ?? current.full_name ?? undefined,
        avatar_url: input.avatarUrl ?? current.avatar_url ?? undefined,
        role: input.role ?? current.role,
      },
      ban_duration: input.status ? banDuration : undefined,
    });

    if (authUpdateError) {
      console.error('[user-service] Failed to update Supabase auth user', authUpdateError);
      return { success: false, error: authUpdateError.message, status: 400 };
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (updateError || !updated) {
    console.error('[user-service] Failed to update profile row', updateError);
    return { success: false, error: 'Failed to update user', status: 500 };
  }

  await logAuditEvent(supabase, {
    actorId,
    userId,
    action: 'user.updated',
    previous: {
      role: current.role,
      status: current.status,
    },
    next: {
      role: updated.role,
      status: updated.status,
    },
  });

  return { success: true, data: mapProfile(updated) };
}

export async function deactivateUser(
  actorId: string,
  userId: string
): Promise<ServiceResult<UserSummary>> {
  return updateUser(actorId, userId, { status: 'deactivated' });
}

export async function createApiToken(
  actorId: string,
  input: CreateTokenInput
): Promise<ServiceResult<CreateTokenResult>> {
  const supabase = getServiceClient();
  const authz = await ensureActorAuthorization(supabase, actorId);
  if (!authz.success) return authz;

  const plainToken = randomBytes(32).toString('hex');
  const hashed = createHash('sha256').update(plainToken).digest('hex');

  const { data, error } = await supabase
    .from('user_api_tokens')
    .insert({
      user_id: input.userId,
      name: input.name,
      description: input.description ?? null,
      hashed_token: hashed,
      metadata: input.metadata ?? {},
      expires_at: input.expiresAt ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[user-service] Failed to create API token', error);
    return { success: false, error: 'Failed to create token', status: 500 };
  }

  await logAuditEvent(supabase, {
    actorId,
    userId: input.userId,
    action: 'user.token.created',
    next: { token_id: data.id },
  });

  return {
    success: true,
    data: {
      tokenId: data.id,
      token: plainToken,
      name: data.name,
      expiresAt: data.expires_at,
    },
  };
}

export async function revokeApiToken(
  actorId: string,
  userId: string,
  tokenId: string
): Promise<ServiceResult<UserApiTokenSummary>> {
  const supabase = getServiceClient();
  const authz = await ensureActorAuthorization(supabase, actorId);
  if (!authz.success) return authz;

  const { data, error } = await supabase
    .from('user_api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) {
    console.error('[user-service] Failed to revoke API token', error);
    return { success: false, error: 'Failed to revoke token', status: 500 };
  }

  await logAuditEvent(supabase, {
    actorId,
    userId,
    action: 'user.token.revoked',
    previous: { token_id: tokenId },
  });

  return { success: true, data: mapToken(data) };
}
