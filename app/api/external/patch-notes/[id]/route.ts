import { NextRequest, NextResponse } from "next/server";
import { fetchSanitizedPatchNote } from "@/lib/external-api";

type RouteParams = {
  params: {
    id: string;
  };
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const note = await fetchSanitizedPatchNote(params.id);

    if (!note) {
      return NextResponse.json({ error: "Patch note not found" }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load patch note" },
      { status: 500 }
    );
  }
}
