import type { Database, Json, Tables } from '@/lib/supabase/database.types';

export type UserRole = Database['public']['Enums']['user_role_type'];

export type UserProfileRow = Tables<'user_profiles'>;

export interface ManagedUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  fullName: string | null;
  avatarUrl: string | null;
  metadata: Json;
  lastSignInAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UserListPagination {
  page: number;
  perPage: number;
  total: number;
  nextPage: number | null;
  lastPage: number | null;
}

export interface UserListResult {
  users: ManagedUser[];
  pagination: UserListPagination;
}

export type UserMetadata = Json | Record<string, unknown>;

