import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("typefully_configs")
      .select("id, profile_id, team_id, updated_at")
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const hasApiKey = !!process.env.TYPEFULLY_API_KEY || !!data?.id;

    return NextResponse.json({
      configured: !!data || !!process.env.TYPEFULLY_API_KEY,
      profileId: data?.profile_id || process.env.TYPEFULLY_PROFILE_ID || null,
      teamId: data?.team_id || process.env.TYPEFULLY_TEAM_ID || null,
      hasApiKey,
      updatedAt: data?.updated_at || null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to fetch config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, profileId, teamId } = body as {
      apiKey?: string;
      profileId?: string;
      teamId?: string | null;
    };

    if (!apiKey || !profileId) {
      return NextResponse.json(
        { error: "apiKey and profileId are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Read existing row (singleton)
    const existing = await supabase
      .from("typefully_configs")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existing.error) {
      return NextResponse.json({ error: existing.error.message }, { status: 500 });
    }

    const payload: import("@/lib/supabase/database.types").Database["public"]["Tables"]["typefully_configs"]["Insert"] = {
      api_key: apiKey,
      profile_id: profileId,
      team_id: teamId ?? null,
    };

    if (existing.data?.id) {
      const { error: updateError } = await supabase
        .from("typefully_configs")
        .update(payload)
        .eq("id", existing.data.id);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, id: existing.data.id });
    }

    const { data: insertData, error: insertError } = await supabase
      .from("typefully_configs")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: insertData.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to save config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
