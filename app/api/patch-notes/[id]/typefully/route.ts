import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/lib/supabase/database.types";
import { generateTweetThread, type CommitSummary } from "@/lib/ai-summarizer";
import { createTypefullyDraft } from "@/lib/typefully";
import type { PatchNoteFilters } from "@/types/patch-note";

type PatchNoteRow = Database["public"]["Tables"]["patch_notes"]["Row"];

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

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

    const filters = patchNote.filter_metadata as PatchNoteFilters | null;
    const commitSummaries = patchNote.ai_summaries as
      | CommitSummary[]
      | null;

    const thread = await generateTweetThread(patchNote.repo_name || patchNote.title || "Repository", filters || undefined, {
      overallSummary: patchNote.ai_overall_summary,
      commitSummaries: commitSummaries || undefined,
      markdownContent: patchNote.content || undefined,
    });

    const draft = await createTypefullyDraft(thread, {
      title: patchNote.title || undefined,
    });

    return NextResponse.json({
      thread,
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
