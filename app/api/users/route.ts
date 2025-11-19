import { NextRequest, NextResponse } from "next/server";
import {
  listManagedUsers,
  inviteUser,
  validateInviteUserPayload,
  type ListUsersInput,
} from "@/lib/services";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const pageParam = searchParams.get("page");
  const perPageParam = searchParams.get("perPage");
  const includeInvitesParam = searchParams.get("includeInvites");

  const input: ListUsersInput = {
    page: pageParam && !Number.isNaN(Number(pageParam)) ? Number(pageParam) : undefined,
    perPage:
      perPageParam && !Number.isNaN(Number(perPageParam))
        ? Number(perPageParam)
        : undefined,
    search: searchParams.get("search") ?? undefined,
    includeInvites:
      includeInvitesParam !== null
        ? includeInvitesParam === "true"
        : undefined,
  };

  const result = await listManagedUsers(input);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data);
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);

  const validation = validateInviteUserPayload(payload);

  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const result = await inviteUser(validation.data);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data, { status: 201 });
}
