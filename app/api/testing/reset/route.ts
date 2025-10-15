import { NextResponse } from "next/server";

export async function POST() {
  if (process.env.REPATCH_TEST_MODE !== "mock") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { resetMockStore } = await import("@/lib/testing/mockStore");
  resetMockStore();
  return NextResponse.json({ ok: true });
}
