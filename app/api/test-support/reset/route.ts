import { NextResponse } from "next/server";
import { resetMockSupabase } from "@/lib/supabase/mock-client";
import { usingMockSupabase } from "@/lib/testing/test-environment";

export async function POST() {
  if (!usingMockSupabase()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  resetMockSupabase();
  return NextResponse.json({ ok: true });
}
