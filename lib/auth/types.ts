/**
 * Auth-related TypeScript types
 */

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  full_name?: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
