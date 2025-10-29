import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, type Database } from "@/lib/supabase";
import { cookies } from "next/headers";
import { createTypefullyDraft } from "@/lib/typefully";

type PatchNoteRow = Database["public"]["Tables"]["patch_notes"]["Row"];

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    const { data: patchNote, error } = await supabase
      .from("patch_notes")
      .select("*")
      .eq("id", id)
      .single<PatchNoteRow>();

    if (error || !patchNote) {
      return NextResponse.json(
        { error: "Patch note not found" },
        { status: 404 }
      );
    }

    if (!process.env.TYPEFULLY_API_KEY) {
      return NextResponse.json(
        { error: "TYPEFULLY_API_KEY is not configured" },
        { status: 400 }
      );
    }

    // Use the final markdown content directly (Step 2 output)
    const content = patchNote.content || "";
    
    if (!content.trim()) {
      return NextResponse.json(
        { error: "Patch note has no content to post" },
        { status: 400 }
      );
    }

    // Post the content as-is (already summarized and tweet-ready)
    const draft = await createTypefullyDraft([content], {
      threadify: false, // Content is already in the right format
      share: true, // Generate a shareable link
    });

    return NextResponse.json({
      content,
      draft,
    });
  } catch (error) {
    console.error("Error creating Typefully draft:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Typefully draft",
      },
      { status: 500 }
    );
  }
}
