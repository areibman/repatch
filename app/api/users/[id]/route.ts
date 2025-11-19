import { NextRequest, NextResponse } from "next/server";
import {
  getManagedUser,
  updateManagedUser,
  deleteManagedUser,
  validateUpdateUserPayload,
} from "@/lib/services";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_: NextRequest, { params }: RouteContext) {
  const userId = params.id;

  const result = await getManagedUser({ userId });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json(result.data);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const payload = await request.json().catch(() => ({}));

  const validation = validateUpdateUserPayload({
    ...payload,
    userId: params.id,
  });

  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const result = await updateManagedUser(validation.data);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data);
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const result = await deleteManagedUser({ userId: params.id });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
