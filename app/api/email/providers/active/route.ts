import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { resolveActiveEmailProvider } from "@/lib/email/service";

export async function GET() {
  const supabase = await createClient();

  try {
    const active = await resolveActiveEmailProvider(supabase);
    return NextResponse.json({
      provider: active.summary,
      source: active.source,
    });
  } catch (error) {
    console.error("Failed to resolve active email provider", error);
    return NextResponse.json(
      { error: "Failed to resolve active email provider" },
      { status: 500 }
    );
  }
}
