import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api/with-auth";
import type { Database } from "@/lib/supabase";
import { createTypefullyDraft } from "@/lib/typefully";

type PatchNoteRow = Database["public"]["Tables"]["patch_notes"]["Row"];

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async ({ supabase, auth }) => {
    try {
      const { id } = await params;

      const { data: patchNote, error } = await supabase
        .from("patch_notes")
        .select("*")
        .eq("id", id)
        .eq("owner_id", auth.user.id)
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

      const content = patchNote.content || "";

      if (!content.trim()) {
        return NextResponse.json(
          { error: "Patch note has no content to post" },
          { status: 400 }
        );
      }

      const draft = await createTypefullyDraft([content], {
        threadify: false,
        share: true,
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
  });
}
