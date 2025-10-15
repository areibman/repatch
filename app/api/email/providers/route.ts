import { NextResponse } from "next/server";
import { getSanitizedIntegrations } from "@/lib/email";

export async function GET() {
  try {
    const summary = await getSanitizedIntegrations();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to load email provider summary", error);
    return NextResponse.json(
      { error: "Failed to load email provider summary" },
      { status: 500 }
    );
  }
}
