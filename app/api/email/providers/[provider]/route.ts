import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getEnvFallbackIntegration,
  sanitizeIntegration,
} from "@/lib/email";
import { EmailProviderName } from "@/lib/email/types";

function isEmailProviderName(value: string): value is EmailProviderName {
  return value === "resend" || value === "customerio";
}

function sanitizeCredentialPayload(
  provider: EmailProviderName,
  credentials: Record<string, unknown>,
  existing?: Record<string, unknown> | null
) {
  if (provider === "resend") {
    const apiKey =
      credentials?.apiKey ?? existing?.apiKey ?? existing?.api_key;
    const audienceId = credentials?.audienceId ?? existing?.audienceId;

    if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
      throw new Error("Resend requires an API key");
    }

    return {
      apiKey: apiKey.trim(),
      audienceId:
        typeof audienceId === "string" && audienceId.trim().length > 0
          ? audienceId.trim()
          : undefined,
    };
  }

  const siteId =
    credentials?.siteId ?? existing?.siteId ?? existing?.site_id ?? "";
  const apiKey =
    credentials?.apiKey ?? existing?.apiKey ?? existing?.api_key ?? "";
  const appKey =
    credentials?.appKey ?? existing?.appKey ?? existing?.app_key ?? "";
  const transactionalMessageId =
    credentials?.transactionalMessageId ??
    existing?.transactionalMessageId ??
    existing?.transactional_message_id ??
    "";
  const region = credentials?.region ?? existing?.region;

  if (typeof siteId !== "string" || siteId.trim().length === 0) {
    throw new Error("Customer.io requires a Site ID");
  }

  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new Error("Customer.io requires an API key");
  }

  if (typeof appKey !== "string" || appKey.trim().length === 0) {
    throw new Error("Customer.io requires an App API key");
  }

  if (
    typeof transactionalMessageId !== "string" ||
    transactionalMessageId.trim().length === 0
  ) {
    throw new Error("Customer.io requires a transactional message ID");
  }

  return {
    siteId: siteId.trim(),
    apiKey: apiKey.trim(),
    appKey: appKey.trim(),
    transactionalMessageId: transactionalMessageId.trim(),
    ...(typeof region === "string" && region.trim().length > 0
      ? { region: region.trim() as "us" | "eu" }
      : {}),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (!isEmailProviderName(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("email_integrations")
      .select()
      .eq("provider", provider)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return NextResponse.json({
        provider,
        fromEmail: data.from_email,
        isActive: data.is_active,
        updatedAt: data.updated_at,
        configured: true,
      });
    }

    if (provider === "resend") {
      const fallback = getEnvFallbackIntegration();
      if (fallback) {
        const sanitized = sanitizeIntegration(fallback);
        return NextResponse.json({
          ...sanitized,
          configured: true,
          managedByEnv: true,
        });
      }
    }

    return NextResponse.json({
      provider,
      configured: false,
      isActive: false,
    });
  } catch (error) {
    console.error("Failed to load provider", error);
    return NextResponse.json(
      { error: "Failed to load provider" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (!isEmailProviderName(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const fromEmail = (body?.fromEmail ?? "").trim();

    if (!fromEmail) {
      return NextResponse.json(
        { error: "Sender email is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: existing, error: existingError } = await supabase
      .from("email_integrations")
      .select()
      .eq("provider", provider)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const credentials = sanitizeCredentialPayload(
      provider,
      (body?.credentials ?? {}) as Record<string, unknown>,
      (existing?.credentials ?? null) as Record<string, unknown> | null
    );

    const isActive =
      typeof body?.isActive === "boolean"
        ? body.isActive
        : typeof body?.setActive === "boolean"
        ? body.setActive
        : existing?.is_active ?? false;

    const { data, error } = await supabase
      .from("email_integrations")
      .upsert(
        {
          provider,
          from_email: fromEmail,
          credentials,
          is_active: isActive,
        },
        { onConflict: "provider" }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (isActive) {
      await supabase
        .from("email_integrations")
        .update({ is_active: false })
        .neq("provider", provider);
    }

    return NextResponse.json({
      provider,
      fromEmail: data.from_email,
      isActive: data.is_active,
      updatedAt: data.updated_at,
      configured: true,
    });
  } catch (error) {
    console.error("Failed to update provider", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save provider" },
      { status: 500 }
    );
  }
}
