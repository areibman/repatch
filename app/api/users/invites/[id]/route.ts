import { NextRequest, NextResponse } from "next/server";
import { revokeInvite } from "@/lib/services";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function PATCH(_: NextRequest, { params }: RouteContext) {
  const result = await revokeInvite({ inviteId: params.id });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
