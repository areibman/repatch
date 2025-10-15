import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("typefully_configs")
      .select("id, display_name, profile_id, updated_at")
      .eq("slug", "default")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      profileId: data.profile_id,
      displayName: data.display_name,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load Typefully status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
