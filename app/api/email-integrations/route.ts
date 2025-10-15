import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  EmailProviderConfigurationError,
  EmailProviderId,
  getEmailIntegrationSummaries,
} from "@/lib/email";

function sanitizeCredentials(input: Record<string, unknown>): Record<string, string> {
  return Object.entries(input).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === "string" && value.trim().length > 0) {
      acc[key] = value.trim();
    }
    return acc;
  }, {});
}

export async function GET() {
  try {
    const { summaries, active } = await getEmailIntegrationSummaries();

    return NextResponse.json({
      providers: summaries,
      activeProvider: active ?? null,
    });
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
    const provider: EmailProviderId | undefined = body.provider;

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("email_integrations")
      .select("*")
      .eq("provider", provider)
      .maybeSingle();

    const credentialsInput = sanitizeCredentials(body.credentials ?? {});

    if (body.audienceId) {
      credentialsInput.audienceId = body.audienceId;
    }

    const defaultSender =
      body.defaultSender === ""
        ? null
        : body.defaultSender
        ? String(body.defaultSender)
        : existing?.default_sender ?? null;

    const payload = {
      provider,
      credentials: {
        ...((existing?.credentials as Record<string, string>) ?? {}),
        ...credentialsInput,
      },
      default_sender: defaultSender,
      is_active: existing?.is_active ?? false,
    };

    const { error } = await supabase.from("email_integrations").upsert(payload, {
      onConflict: "provider",
    });

    if (error) {
      throw error;
    }

    const { summaries, active } = await getEmailIntegrationSummaries();

    return NextResponse.json({
      providers: summaries,
      activeProvider: active ?? null,
    });
  } catch (error) {
    console.error("Failed to store email integration", error);
    return NextResponse.json(
      { error: "Failed to store email integration" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const provider: EmailProviderId | undefined = body.activeProvider;

    if (!provider) {
      return NextResponse.json(
        { error: "activeProvider is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("email_integrations")
      .select("provider")
      .eq("provider", provider)
      .maybeSingle();

    if (!existing) {
      throw new EmailProviderConfigurationError(
        "Set credentials for the provider before making it active."
      );
    }

    const deactivate = await supabase
      .from("email_integrations")
      .update({ is_active: false })
      .neq("provider", provider);

    if (deactivate.error) {
      throw deactivate.error;
    }

    const activate = await supabase
      .from("email_integrations")
      .update({ is_active: true })
      .eq("provider", provider);

    if (activate.error) {
      throw activate.error;
    }

    const { summaries, active } = await getEmailIntegrationSummaries();

    return NextResponse.json({
      providers: summaries,
      activeProvider: active ?? null,
    });
  } catch (error) {
    if (error instanceof EmailProviderConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Failed to set active provider", error);
    return NextResponse.json(
      { error: "Failed to set active provider" },
      { status: 500 }
    );
  }
}
