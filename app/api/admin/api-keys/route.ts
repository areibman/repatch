import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiKey, listApiKeys } from "@/lib/api-keys";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().max(500).optional().nullable(),
  createdBy: z.string().max(120).optional().nullable(),
  rateLimitPerMinute: z.number().int().min(1).max(5000).optional(),
  metadata: z.record(z.any()).optional().nullable(),
});

export async function GET() {
  try {
    const keys = await listApiKeys();
    return NextResponse.json(keys);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const body = createSchema.parse(payload);

    const { key, secret } = await createApiKey({
      name: body.name,
      description: body.description ?? null,
      createdBy: body.createdBy ?? null,
      rateLimitPerMinute: body.rateLimitPerMinute,
      metadata: body.metadata ?? null,
    });

    return NextResponse.json({ key, secret }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.flatten().formErrors.join("; ") || "Invalid input" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create API key" },
      { status: 500 }
    );
  }
}
