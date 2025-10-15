import { NextResponse } from "next/server";
import { getSanitizedPatchNote } from "@/lib/external/patch-notes";

type Params = {
  params: { id: string };
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const note = await getSanitizedPatchNote(params.id);
    if (!note) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data: note });
  } catch (error) {
    console.error("Failed to fetch patch note", error);
    return NextResponse.json(
      { error: "Failed to fetch patch note" },
      { status: 500 }
    );
  }
}
