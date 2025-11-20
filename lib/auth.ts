import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createHash } from "crypto";

import type { Database, Tables } from "@/lib/supabase/database.types";
import type { UserRole } from "@/types/user-management";

const ROLE_ORDER: UserRole[] = ["viewer", "editor", "admin"];

export class AuthError extends Error {
  constructor(message: string, public status: number = 401) {
    super(message);
    this.name = "AuthError";
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message = "Authentication required") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AuthError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

export interface AuthContext {
  user: User;
  profile: Tables<"user_profiles"> | null;
  role: UserRole;
  token?: {
    id: string;
    prefix: string;
    scopes: string[];
  };
}

interface GetUserOptions {
  requireActive?: boolean;
  skipProfile?: boolean;
}

export async function getUserOrThrow(
  supabase: SupabaseClient<Database>,
  options: GetUserOptions = {}
): Promise<AuthContext> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    throw new UnauthorizedError();
  }

  if (options.skipProfile) {
    return {
      user: data.user,
      profile: null,
      role: "viewer",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role, is_active, full_name, avatar_url, email, id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    throw new AuthError("Failed to load user profile", 500);
  }

  if (options.requireActive !== false && profile && !profile.is_active) {
    throw new ForbiddenError("User is inactive");
  }

  return {
    user: data.user,
    profile,
    role: (profile?.role ?? "viewer") as UserRole,
  };
}

export function requireRole(
  auth: Pick<AuthContext, "role">,
  allowedRoles: UserRole[] = ROLE_ORDER
) {
  if (!hasRole(auth, allowedRoles)) {
    throw new ForbiddenError();
  }
}

export function hasRole(
  auth: Pick<AuthContext, "role">,
  allowedRoles: UserRole[] = ROLE_ORDER
) {
  return allowedRoles.includes(auth.role);
}

export function roleAtLeast(
  auth: Pick<AuthContext, "role">,
  minimumRole: UserRole
) {
  return (
    ROLE_ORDER.indexOf(auth.role) >= ROLE_ORDER.indexOf(minimumRole)
  );
}

export function buildAuthContext(
  user: User,
  profile: Tables<"user_profiles"> | null
): AuthContext {
  return {
    user,
    profile,
    role: (profile?.role ?? "viewer") as UserRole,
  };
}

export function hashPersonalAccessToken(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

