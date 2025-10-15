import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revokeApiKey } from "@/lib/api-keys";

const revokeSchema = z.object({
  reason: z.string().max(500).optional().nullable(),
});

type RouteParams = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const payload = await request.json().catch(() => ({}));
    const body = revokeSchema.parse(payload);

    const key = await revokeApiKey({
      id: params.id,
      reason: body.reason ?? null,
    });

    return NextResponse.json({ key });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.flatten().formErrors.join("; ") || "Invalid input" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to revoke API key" },
      { status: 500 }
    );
  }
}
