import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProviderSettings,
  listEmailIntegrations,
  mergeSettings,
} from "@/lib/email/integrations";
import type {
  CustomerIoSettings,
  EmailIntegrationConfig,
  EmailProvider,
  ProviderSettingsMap,
  ResendSettings,
} from "@/types/email";

function sanitizeSettings(
  provider: EmailProvider,
  settings: ProviderSettingsMap[EmailProvider]
): ProviderSettingsMap[EmailProvider] {
  if (provider === "resend") {
    const typed = settings as ResendSettings;
    return {
      ...typed,
      apiKey: typed.apiKey ? "********" : null,
    } as ResendSettings;
  }

  const typed = settings as CustomerIoSettings;
  return {
    ...typed,
    appApiKey: typed.appApiKey ? "********" : null,
  } as CustomerIoSettings;
}

function normalizeSettings(
  provider: EmailProvider,
  updates: Partial<ProviderSettingsMap[EmailProvider]>
): Partial<ProviderSettingsMap[EmailProvider]> {
  if (provider === "resend") {
    const incoming = updates as Partial<ResendSettings>;
    const result: Partial<ResendSettings> = {};

    if (incoming.apiKey !== undefined) {
      const value = incoming.apiKey?.toString().trim();
      result.apiKey = value || null;
    }

    if (incoming.audienceId !== undefined) {
      const value = incoming.audienceId?.toString().trim();
      result.audienceId = value || null;
    }

    if (incoming.replyTo !== undefined) {
      const value = incoming.replyTo?.toString().trim();
      result.replyTo = value || null;
    }

    if (incoming.fromEmail !== undefined) {
      const value = incoming.fromEmail?.toString().trim();
      result.fromEmail = value || null;
    }

    if (incoming.fromName !== undefined) {
      const value = incoming.fromName?.toString().trim();
      result.fromName = value || null;
    }

    return result;
  }

  const incoming = updates as Partial<CustomerIoSettings>;
  const region = incoming.region?.toString().toLowerCase();
  const result: Partial<CustomerIoSettings> = {};

  if (incoming.appApiKey !== undefined) {
    const value = incoming.appApiKey?.toString().trim();
    result.appApiKey = value || null;
  }

  if (incoming.region !== undefined) {
    result.region = region === "eu" ? "eu" : region === "us" ? "us" : null;
  }

  if (incoming.fromEmail !== undefined) {
    const value = incoming.fromEmail?.toString().trim();
    result.fromEmail = value || null;
  }

  if (incoming.fromName !== undefined) {
    const value = incoming.fromName?.toString().trim();
    result.fromName = value || null;
  }

  return result;
}

function isValidProvider(value: unknown): value is EmailProvider {
  return value === "resend" || value === "customerio";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const providers = await listEmailIntegrations(supabase);
    const sanitized = providers.map((provider) => ({
      ...provider,
      settings: sanitizeSettings(provider.provider, provider.settings),
    }));

    return NextResponse.json({
      providers: sanitized,
      active: sanitized.find((provider) => provider.isActive) ?? null,
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
    const providerValue = body.provider;

    if (!isValidProvider(providerValue)) {
      return NextResponse.json(
        { error: "Unknown email provider" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const current = await listEmailIntegrations(supabase);
    const existing = current.find((config) => config.provider === providerValue);

    const normalizedSettings = normalizeSettings(providerValue, body.settings ?? {});
    const baseSettings = existing
      ? (existing.settings as ProviderSettingsMap[typeof providerValue])
      : getDefaultProviderSettings(providerValue);
    const merged = mergeSettings(baseSettings, normalizedSettings);

    if (body.activate) {
      await supabase
        .from("email_integrations")
        .update({ is_active: false })
        .neq("provider", providerValue);
    }

    const upsertPayload = {
      id: existing?.id,
      provider: providerValue,
      settings: merged,
      is_active: body.activate ? true : existing?.isActive ?? false,
    };

    const { data, error } = await supabase
      .from("email_integrations")
      .upsert(upsertPayload, { onConflict: "provider" })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    let updatedRow = data;

    if (body.activate && data) {
      const { data: activated, error: activationError } = await supabase
        .from("email_integrations")
        .update({ is_active: true })
        .eq("id", data.id)
        .select()
        .single();

      if (activationError) {
        throw new Error(activationError.message);
      }

      updatedRow = activated;
    }

    const responseConfig: EmailIntegrationConfig = {
      id: updatedRow.id,
      provider: updatedRow.provider,
      isActive: updatedRow.is_active,
      settings: sanitizeSettings(
        updatedRow.provider,
        merged
      ) as ProviderSettingsMap[EmailProvider],
      source: "database",
    };

    return NextResponse.json(responseConfig);
  } catch (error) {
    console.error("Failed to save email integration", error);
    return NextResponse.json(
      { error: "Failed to save email integration" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const providerValue = body.provider;

    if (!isValidProvider(providerValue)) {
      return NextResponse.json(
        { error: "Unknown email provider" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const existingResponse = await supabase
      .from("email_integrations")
      .select("*")
      .eq("provider", providerValue)
      .maybeSingle();

    let target = existingResponse.data;

    if (!target) {
      const current = await listEmailIntegrations(supabase);
      const config = current.find((item) => item.provider === providerValue);
      const settings = config
        ? config.settings
        : getDefaultProviderSettings(providerValue);

      const { data, error } = await supabase
        .from("email_integrations")
        .upsert(
          {
            provider: providerValue,
            settings,
            is_active: true,
          },
          { onConflict: "provider" }
        )
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      target = data;
    }

    await supabase
      .from("email_integrations")
      .update({ is_active: false })
      .neq("provider", providerValue);

    const { data: activated, error: activationError } = await supabase
      .from("email_integrations")
      .update({ is_active: true })
      .eq("provider", providerValue)
      .select()
      .single();

    if (activationError) {
      throw new Error(activationError.message);
    }

    const updatedConfig: EmailIntegrationConfig = {
      id: activated.id,
      provider: activated.provider,
      isActive: true,
      settings: sanitizeSettings(
        activated.provider,
        activated.settings as ProviderSettingsMap[EmailProvider]
      ),
      source: "database",
    };

    return NextResponse.json(updatedConfig);
  } catch (error) {
    console.error("Failed to activate email provider", error);
    return NextResponse.json(
      { error: "Failed to activate email provider" },
      { status: 500 }
    );
  }
}
