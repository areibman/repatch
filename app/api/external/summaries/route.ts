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

    const summaries = notes.map((note) => ({
      id: note.id,
      title: note.title,
      summary: note.summary,
      generatedAt: note.generatedAt,
      repo: note.repo,
      timePeriod: note.timePeriod,
    }));

    return NextResponse.json(summaries);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load summaries" },
      { status: 500 }
    );
  }
}
