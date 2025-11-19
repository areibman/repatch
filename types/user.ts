import { Constants, type Database, type Tables } from '@/lib/supabase/database.types';

export type UserRole = Database['public']['Enums']['user_role_type'];
export type UserStatus = Database['public']['Enums']['user_status_type'];

export const USER_ROLE_OPTIONS = Constants.public.Enums.user_role_type;
export const USER_STATUS_OPTIONS = Constants.public.Enums.user_status_type;

export type UserProfileRow = Tables<'user_profiles'>;

export interface ManagedUser {
  id: string;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  fullName: string | null;
  avatarUrl: string | null;
  metadata: Record<string, unknown>;
  lastSignInAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  factors: unknown[];
  provider?: string | null;
}
