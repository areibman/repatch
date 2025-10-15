import { NextRequest, NextResponse } from "next/server";
import { fetchSanitizedPatchNotes } from "@/lib/external-api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    const notes = await fetchSanitizedPatchNotes(
      Number.isFinite(limit) && limit! > 0 ? limit : undefined
    );

    return NextResponse.json(notes);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load patch notes" },
      { status: 500 }
    );
  }
}
