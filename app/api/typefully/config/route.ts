import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const REQUIRED_FIELDS = ["apiKey", "profileId"] as const;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("typefully_configs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ config: data ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load Typefully configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    for (const field of REQUIRED_FIELDS) {
      if (!body?.[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("typefully_configs")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let result;
    if (existing?.id) {
      result = await supabase
        .from("typefully_configs")
        .update({
          api_key: body.apiKey,
          profile_id: body.profileId,
          workspace_id: body.workspaceId || null,
        })
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("typefully_configs")
        .insert({
          api_key: body.apiKey,
          profile_id: body.profileId,
          workspace_id: body.workspaceId || null,
        })
        .select()
        .single();
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ config: result.data });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save Typefully configuration" },
      { status: 500 }
    );
  }
}
