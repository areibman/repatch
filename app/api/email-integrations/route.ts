import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchIntegrationRows,
  getActiveIntegration,
  normalizeIntegration,
  summarizeIntegration,
} from "@/lib/email/integrations";
import type { EmailIntegrationSettings, EmailProviderName } from "@/lib/email/types";

function formatError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") return error;
  return fallback;
}

function isValidProvider(value: string): value is EmailProviderName {
  return value === "resend" || value === "customer_io";
}

function sanitizeMetadata(metadata: unknown) {
  if (metadata && typeof metadata === "object") {
    return metadata;
  }
  return {};
}

export async function GET() {
  try {
    const supabase = await createClient();
    const rows = await fetchIntegrationRows(supabase);

    const integrations = rows
      .map((row) => normalizeIntegration(row, row.provider))
      .filter((integration): integration is EmailIntegrationSettings => Boolean(integration));

    const hasResend = integrations.some((integration) => integration?.provider === "resend");
    if (!hasResend) {
      const fallback = normalizeIntegration(null, "resend");
      if (fallback) integrations.push(fallback);
    }

    const active = await getActiveIntegration(supabase);

    return NextResponse.json({
      integrations: integrations.map((integration) =>
        summarizeIntegration(integration)
      ),
      active: summarizeIntegration(active),
    });
  } catch (error) {
    return NextResponse.json(
      { error: formatError(error, "Failed to load integrations") },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const provider = body.provider;

    if (!provider || !isValidProvider(provider)) {
      return NextResponse.json(
        { error: "Invalid provider" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    if (body.isActive) {
      await supabase
        .from("email_integrations")
        .update({ is_active: false })
        .neq("provider", provider);
    }

    const payload: Record<string, unknown> = { provider };

    if (body.displayName !== undefined)
      payload.display_name = body.displayName ?? null;
    if (body.fromEmail !== undefined)
      payload.from_email = body.fromEmail ?? null;
    if (body.apiKey !== undefined) payload.api_key = body.apiKey ?? null;
    if (body.audienceId !== undefined)
      payload.audience_id = body.audienceId ?? null;
    if (body.siteId !== undefined) payload.site_id = body.siteId ?? null;
    if (body.trackApiKey !== undefined)
      payload.track_api_key = body.trackApiKey ?? null;
    if (body.transactionalMessageId !== undefined)
      payload.transactional_message_id = body.transactionalMessageId ?? null;
    if (body.metadata !== undefined)
      payload.metadata = sanitizeMetadata(body.metadata);
    if (body.isActive !== undefined)
      payload.is_active = Boolean(body.isActive);

    const { data, error } = await supabase
      .from("email_integrations")
      .upsert(payload, { onConflict: "provider" })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Failed to save integration");
    }

    const integration = normalizeIntegration(data, provider);
    if (!integration) {
      throw new Error("Provider configuration incomplete");
    }
    const active = await getActiveIntegration(supabase);

    return NextResponse.json({
      integration: summarizeIntegration(integration),
      active: summarizeIntegration(active),
    });
  } catch (error) {
    return NextResponse.json(
      { error: formatError(error, "Failed to save integration") },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const provider = body.provider;

    if (!provider || !isValidProvider(provider)) {
      return NextResponse.json(
        { error: "Invalid provider" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    await supabase
      .from("email_integrations")
      .update({ is_active: false })
      .neq("provider", provider);

    const { data, error } = await supabase
      .from("email_integrations")
      .update({ is_active: true })
      .eq("provider", provider)
      .select("*")
      .single();

    let integration = data ? normalizeIntegration(data, provider) : null;

    if (!integration) {
      // If the provider doesn't exist yet, bootstrap it from environment defaults
      const fallback = normalizeIntegration(null, provider);
      if (!fallback) {
        throw new Error("Provider credentials missing");
      }

      const { data: created, error: upsertError } = await supabase
        .from("email_integrations")
        .upsert(
          {
            provider,
            display_name: fallback.displayName,
            from_email: fallback.fromEmail,
            api_key: null,
            audience_id: fallback.audienceId ?? null,
            site_id: fallback.siteId ?? null,
            track_api_key: fallback.trackApiKey ?? null,
            transactional_message_id: fallback.transactionalMessageId ?? null,
            metadata: fallback.metadata ?? {},
            is_active: true,
          },
          { onConflict: "provider" }
        )
        .select("*")
        .single();

      if (upsertError || !created) {
        throw new Error(upsertError?.message || "Failed to activate provider");
      }

      integration = normalizeIntegration(created, provider);
    }

    const active = await getActiveIntegration(supabase);

    return NextResponse.json({
      integration: summarizeIntegration(integration),
      active: summarizeIntegration(active),
    });
  } catch (error) {
    return NextResponse.json(
      { error: formatError(error, "Failed to update provider status") },
      { status: 500 }
    );
  }
}
