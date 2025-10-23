import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchEmailIntegrations,
  sanitizeIntegration,
  upsertEmailIntegration,
} from "@/lib/email/integrations";
import type { EmailProviderId } from "@/lib/email/types";

const SUPPORTED_PROVIDERS: EmailProviderId[] = ["resend", "customerio"];

function normalizeSettings(settings: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...settings };
  delete normalized.hasApiKey;
  delete normalized.hasAppApiKey;
  delete normalized.hasTrackCredentials;
  return normalized;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const integrations = await fetchEmailIntegrations(supabase);

    return NextResponse.json(integrations.map(sanitizeIntegration));
  } catch (error) {
    console.error("Failed to load email integrations", error);
    return NextResponse.json(
      { error: "Failed to load email integrations" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const provider = body.provider as EmailProviderId;
    const makeActive = Boolean(body.isActive);

    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: "Unsupported email provider" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const updated = await upsertEmailIntegration(
      supabase,
      provider,
      normalizeSettings(body.settings ?? {}),
      makeActive
    );

    return NextResponse.json(sanitizeIntegration(updated));
  } catch (error) {
    console.error("Failed to update email integration", error);
    return NextResponse.json(
      { error: "Failed to update email integration" },
      { status: 500 }
    );
  }
}
