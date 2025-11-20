import type { Database, Json } from '@/lib/supabase/database.types';

export type UserRole = Database['public']['Enums']['user_role_type'];
export type UserStatus = Database['public']['Enums']['user_status_type'];

export type UserProfileRow = Database['public']['Tables']['user_profiles']['Row'];
export type UserApiTokenRow = Database['public']['Tables']['user_api_tokens']['Row'];

export interface UserSummary {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  metadata: Json;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserDetail extends UserSummary {
  tokens: UserApiTokenSummary[];
}

export interface UserListResult {
  data: UserSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface UserApiTokenSummary {
  id: string;
  name: string;
  description: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  metadata: Json;
  createdAt: string;
}

export interface CreateUserInput {
  email: string;
  password?: string;
  fullName?: string;
  avatarUrl?: string;
  role?: UserRole;
  status?: UserStatus;
  metadata?: Json;
  sendWelcomeEmail?: boolean;
}

export interface UpdateUserInput {
  email?: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  role?: UserRole;
  status?: UserStatus;
  metadata?: Json;
}

export interface ListUsersFilters {
  search?: string;
  roles?: UserRole[];
  statuses?: UserStatus[];
  limit?: number;
  offset?: number;
}

export interface CreateTokenInput {
  userId: string;
  name: string;
  description?: string;
  expiresAt?: string;
  metadata?: Json;
}

export interface CreateTokenResult {
  tokenId: string;
  token: string;
  name: string;
  expiresAt: string | null;
}

export interface CreateUserResult {
  user: UserSummary;
  temporaryPassword?: string;
}
