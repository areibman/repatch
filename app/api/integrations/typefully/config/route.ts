import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/integrations/typefully/config - Check if Typefully is configured
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("typefully_configs")
      .select("id")
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ configured: !!data });
  } catch (error) {
    console.error("Error checking Typefully config:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to check configuration",
      },
      { status: 500 }
    );
  }
}

// POST /api/integrations/typefully/config - Save Typefully API key
export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if a config already exists
    const { data: existing } = await supabase
      .from("typefully_configs")
      .select("id")
      .limit(1)
      .single();

    if (existing) {
      // Update existing config
      const { error } = await supabase
        .from("typefully_configs")
        .update({ api_key: apiKey })
        .eq("id", existing.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // Insert new config
      const { error } = await supabase
        .from("typefully_configs")
        .insert({ api_key: apiKey });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving Typefully config:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save configuration",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/typefully/config - Remove Typefully integration
export async function DELETE() {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("typefully_configs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting Typefully config:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete configuration",
      },
      { status: 500 }
    );
  }
}
