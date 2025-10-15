import { NextRequest, NextResponse } from "next/server";
import { getResendSnapshot, resetMockResend } from "@/lib/resend/client";
import { getSupabaseSnapshot, resetMockSupabase } from "@/lib/supabase/mockClient";

export async function POST(request: NextRequest) {
  if (process.env.ALLOW_TEST_ENDPOINTS !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  if (body?.supabase) {
    resetMockSupabase(body.supabase);
  } else {
    resetMockSupabase();
  }

  if (body?.resend) {
    resetMockResend(body.resend);
  } else {
    resetMockResend();
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  if (process.env.ALLOW_TEST_ENDPOINTS !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    supabase: getSupabaseSnapshot(),
    resend: getResendSnapshot(),
  });
}
