import type { Database } from "@/lib/supabase";

export type UserRole = Database["public"]["Enums"]["user_role_type"];
export type UserInviteStatus = Database["public"]["Enums"]["user_invite_status_type"];

export interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  onboardingState: Record<string, unknown>;
  preferences: Record<string, unknown>;
  lastSignInAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedUserAccount extends UserProfile {
  status: "invited" | "active" | "suspended" | "deleted";
  emailConfirmed: boolean;
  phoneConfirmed: boolean;
  mfaEnabled: boolean;
  factors?: {
    totp?: boolean;
    webAuthn?: boolean;
  };
}

export interface UserInvite {
  id: string;
  email: string;
  role: UserRole;
  status: UserInviteStatus;
  invitedBy: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface ListUsersResponse {
  users: ManagedUserAccount[];
  invites: UserInvite[];
  pagination: {
    page: number;
    perPage: number;
    hasNextPage: boolean;
    nextPageToken: string | null;
  };
}
