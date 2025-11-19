import { NextRequest, NextResponse } from "next/server";
import {
  deleteManagedUser,
  updateManagedUser,
} from "@/lib/services/user-management.service";
import {
  USER_ROLES,
  type UpdateUserPayload,
  type UserRole,
} from "@/types/user";
import {
  formatSupabaseConfigError,
  isSupabaseConfigError,
} from "@/lib/supabase";

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    if (!params.id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const body = (await request.json()) as UpdateUserPayload | Record<string, unknown>;
    const payload: UpdateUserPayload = {};

    if ("fullName" in body) {
      payload.fullName =
        typeof body.fullName === "string"
          ? body.fullName.trim() || null
          : null;
    }

    if ("avatarUrl" in body) {
      payload.avatarUrl =
        typeof body.avatarUrl === "string" && body.avatarUrl.trim().length > 0
          ? body.avatarUrl.trim()
          : null;
    }

    if ("role" in body) {
      const role = coerceRole(body.role);
      if (role) {
        payload.role = role;
      }
    }

    if ("status" in body && typeof body.status === "string") {
      const normalized = body.status.toLowerCase();
      if (normalized === "active" || normalized === "disabled") {
        payload.status = normalized;
      }
    }

    if (
      typeof payload.fullName === "undefined" &&
      typeof payload.avatarUrl === "undefined" &&
      typeof payload.role === "undefined" &&
      typeof payload.status === "undefined"
    ) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const user = await updateManagedUser(params.id, payload);
    return NextResponse.json(user);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_: NextRequest, { params }: RouteParams) {
  try {
    if (!params.id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    await deleteManagedUser(params.id);
    return NextResponse.json({ success: true });
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
  console.error("User management detail API error:", error);

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
