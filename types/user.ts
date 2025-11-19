export const USER_ROLES = ["owner", "admin", "member", "viewer"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type UserStatus = "invited" | "active" | "disabled" | "unknown";

export interface UserAccount {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  lastSignInAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  invitedAt: string | null;
  factorsCount: number;
}

export interface InviteUserPayload {
  email: string;
  fullName?: string;
  role?: UserRole;
}

export interface UpdateUserPayload {
  fullName?: string | null;
  avatarUrl?: string | null;
  role?: UserRole;
  status?: Extract<UserStatus, "active" | "disabled">;
}
