import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLatestTypefullyJobForPatchNote } from "@/lib/typefully";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const job = await getLatestTypefullyJobForPatchNote(id, supabase);
    return NextResponse.json(job);
  } catch (error) {
    console.error("Failed to load Typefully job", error);
    return NextResponse.json(
      { error: "Failed to load Typefully job" },
      { status: 500 }
    );
  }
}
