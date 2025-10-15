import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("typefully_configs")
      .select("id, label, workspace_id, profile_id, team_id, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      id: data.id,
      label: data.label,
      workspaceId: data.workspace_id,
      profileId: data.profile_id,
      teamId: data.team_id,
      updatedAt: data.updated_at,
      hasApiKey: true,
    });
  } catch (error) {
    console.error("Failed to load Typefully config", error);
    return NextResponse.json(
      { error: "Failed to load Typefully configuration" },
      { status: 500 }
    );
  }
}
