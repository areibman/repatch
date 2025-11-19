import { NextRequest, NextResponse } from "next/server";
import {
  inviteManagedUser,
  listManagedUsers,
} from "@/lib/services/user-management.service";
import {
  USER_ROLES,
  type InviteUserPayload,
  type UserRole,
} from "@/types/user";
import {
  formatSupabaseConfigError,
  isSupabaseConfigError,
} from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const perPage = Number(searchParams.get("perPage") ?? "50");

    const result = await listManagedUsers({ page, perPage });
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as InviteUserPayload | Record<string, unknown>;
    const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    const payload: InviteUserPayload = {
      email: rawEmail.toLowerCase(),
      fullName:
        typeof body.fullName === "string" && body.fullName.trim().length > 0
          ? body.fullName.trim()
          : undefined,
      role: coerceRole(body.role),
    };

    const user = await inviteManagedUser(payload);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

function coerceRole(role: unknown): UserRole | undefined {
  if (typeof role !== "string") {
    return undefined;
  }

  return USER_ROLES.includes(role as UserRole) ? (role as UserRole) : undefined;
}

function handleError(error: unknown, status = 500) {
  console.error("User management API error:", error);

  if (isSupabaseConfigError(error)) {
    return NextResponse.json(
      { error: formatSupabaseConfigError(error) },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unexpected error" },
    { status }
  );
}
