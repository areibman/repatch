import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveIntegration, summarizeIntegration } from "@/lib/email/integrations";

export async function GET() {
  try {
    const supabase = await createClient();
    const integration = await getActiveIntegration(supabase);

    return NextResponse.json({
      integration: summarizeIntegration(integration),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load active email provider";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
