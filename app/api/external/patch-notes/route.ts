import { NextRequest, NextResponse } from "next/server";
import { getSanitizedPatchNotes } from "@/lib/external/patch-notes";

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const safeLimit = limit && Number.isFinite(limit) && limit > 0 ? limit : undefined;
    const notes = await getSanitizedPatchNotes(safeLimit ?? 25);
    return NextResponse.json({ data: notes });
  } catch (error) {
    console.error("Failed to fetch external patch notes", error);
    return NextResponse.json(
      { error: "Failed to fetch patch notes" },
      { status: 500 }
    );
  }
}
