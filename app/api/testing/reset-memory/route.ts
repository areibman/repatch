import { NextResponse } from "next/server";
import { resetMemorySupabase } from "@/lib/supabase/memory";

const memoryEnabled =
  process.env.SUPABASE_USE_MEMORY === "true" ||
  process.env.NEXT_PUBLIC_SUPABASE_URL === "memory";

export async function POST() {
  if (!memoryEnabled) {
    return NextResponse.json({ error: "Memory store disabled" }, { status: 404 });
  }

  resetMemorySupabase();
  return NextResponse.json({ ok: true });
}
