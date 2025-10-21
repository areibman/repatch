import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/lib/supabase/database.types";
import { generateTweetThreadFromChangelog } from "@/lib/ai-summarizer";
import { createTypefullyDraft } from "@/lib/typefully";
import { CommitSummary } from "@/types/patch-note";

type PatchNoteRow = Database["public"]["Tables"]["patch_notes"]["Row"];

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!process.env.TYPEFULLY_API_KEY) {
      return NextResponse.json(
        { error: "TYPEFULLY_API_KEY is not configured" },
        { status: 500 }
      );
    }

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

    const commitSummaries = (patchNote.ai_summaries as CommitSummary[] | null) ?? null;

    const thread = await generateTweetThreadFromChangelog({
      repoName: patchNote.repo_name,
      title: patchNote.title,
      changelogMarkdown: patchNote.content,
      overallSummary: patchNote.ai_overall_summary,
      commitSummaries,
    });

    if (!thread || thread.length === 0) {
      return NextResponse.json(
        { error: "Unable to generate tweet thread" },
        { status: 500 }
      );
    }

    const draft = await createTypefullyDraft(thread, {
      title: patchNote.title,
    });

    return NextResponse.json({
      success: true,
      thread,
      draftId: draft.id ?? null,
      draftUrl: draft.url ?? null,
    });
  } catch (error) {
    console.error("Error creating Typefully draft:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
