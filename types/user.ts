import type {
  Database,
  Json,
  Tables,
} from '@/lib/supabase/database.types';

export type UserRole = Database['public']['Enums']['user_role_type'];

export type UserProfile = Tables<'user_profiles'>;

export interface ManagedUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: 'active' | 'invited' | 'banned';
  bannedUntil: string | null;
  createdAt: string;
  updatedAt: string | null;
  lastSignInAt: string | null;
  metadata: Json | null;
  preferences: Json | null;
  factors: string[];
  profile: UserProfile | null;
}

export interface UserListResponse {
  items: ManagedUser[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    nextPage: number | null;
    hasMore: boolean;
  };
  filters: {
    query: string | null;
    includeInvited: boolean;
    includeBanned: boolean;
  };
}

