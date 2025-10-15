import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rotateApiKey } from "@/lib/api-keys";

const rotateSchema = z.object({
  requestedBy: z.string().max(120).optional().nullable(),
});

type RouteParams = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const payload = await request.json().catch(() => ({}));
    const body = rotateSchema.parse(payload);

    const { key, secret } = await rotateApiKey({
      id: params.id,
      requestedBy: body.requestedBy ?? null,
    });

    return NextResponse.json({ key, secret });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.flatten().formErrors.join("; ") || "Invalid input" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to rotate API key" },
      { status: 500 }
    );
  }
}
