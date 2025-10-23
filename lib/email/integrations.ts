import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  type EmailProvider,
  type EmailProviderContext,
  type EmailProviderFactory,
  type EmailProviderId,
  type EmailSubscriber,
} from "./types";
import { ResendProvider, type ResendSettings } from "./providers/resend";
import {
  CustomerIoProvider,
  type CustomerIoSettings,
} from "./providers/customer-io";

export type EmailIntegrationRow =
  Database["public"]["Tables"]["email_integrations"]["Row"];

type IntegrationSettings = Record<string, unknown>;

type SanitizedSettings = Record<string, unknown>;

const PROVIDER_FACTORIES: Record<EmailProviderId, EmailProviderFactory> = {
  resend: (settings, context) =>
    new ResendProvider(settings as ResendSettings, context),
  customerio: (settings, context) =>
    new CustomerIoProvider(settings as CustomerIoSettings, context),
};

function sanitizeSettings(
  provider: EmailProviderId,
  settings: IntegrationSettings
): SanitizedSettings {
  if (provider === "resend") {
    return {
      audienceId: settings.audienceId ?? "",
      fromEmail: settings.fromEmail ?? "",
      fromName: settings.fromName ?? "",
      hasApiKey: Boolean(settings.apiKey || process.env.RESEND_API_KEY),
    };
  }

  return {
    region:
      settings.region || process.env.CUSTOMER_IO_REGION || "us",
    transactionalMessageId:
      settings.transactionalMessageId || "",
    fromEmail: settings.fromEmail ?? "",
    fromName: settings.fromName ?? "",
    trackSiteId: settings.trackSiteId ?? "",
    hasAppApiKey: Boolean(
      settings.appApiKey || process.env.CUSTOMER_IO_APP_API_KEY
    ),
    hasTrackCredentials: Boolean(
      (settings.trackSiteId || process.env.CUSTOMER_IO_SITE_ID) &&
        (settings.trackApiKey || process.env.CUSTOMER_IO_TRACK_API_KEY)
    ),
  };
}

function mergeSettings(
  existing: IntegrationSettings,
  incoming: IntegrationSettings
): IntegrationSettings {
  const merged = { ...existing };

  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) {
      continue;
    }

    if (value === null || value === "") {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

function normalizeProvider(id: string | null | undefined): EmailProviderId {
  return id === "customerio" ? "customerio" : "resend";
}

export async function getServerSupabaseClient() {
  return createServerClient();
}

export async function fetchEmailIntegrations(
  supabase?: SupabaseClient<Database>
) {
  const client = supabase ?? (await getServerSupabaseClient());
  const { data, error } = await client
    .from("email_integrations")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export function sanitizeIntegration(row: EmailIntegrationRow) {
  const provider = normalizeProvider(row.provider);
  return {
    provider,
    isActive: row.is_active,
    settings: sanitizeSettings(provider, (row.settings ?? {}) as IntegrationSettings),
  };
}

export async function upsertEmailIntegration(
  supabase: SupabaseClient<Database>,
  provider: EmailProviderId,
  settings: IntegrationSettings,
  makeActive?: boolean
) {
  const existingResponse = await supabase
    .from("email_integrations")
    .select("*")
    .eq("provider", provider)
    .maybeSingle();

  if (existingResponse.error) {
    throw existingResponse.error;
  }

  const existing = existingResponse.data ?? null;
  const mergedSettings = mergeSettings(existing?.settings ?? {}, settings);

  if (makeActive) {
    await supabase
      .from("email_integrations")
      .update({ is_active: false })
      .neq("provider", provider);
  }

  const upsertResponse = await supabase
    .from("email_integrations")
    .upsert({
      provider,
      settings: mergedSettings,
      is_active: makeActive ?? existing?.is_active ?? false,
    })
    .select("*")
    .single();

  if (upsertResponse.error) {
    throw upsertResponse.error;
  }

  return upsertResponse.data;
}

export async function getActiveIntegration(
  supabase?: SupabaseClient<Database>
) {
  const client = supabase ?? (await getServerSupabaseClient());

  const { data, error } = await client
    .from("email_integrations")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export function instantiateProvider(
  integration: EmailIntegrationRow | null,
  context: EmailProviderContext = {}
): EmailProvider {
  if (!integration) {
    return new ResendProvider({}, context);
  }

  const provider = normalizeProvider(integration.provider);
  const factory = PROVIDER_FACTORIES[provider];

  if (!factory) {
    throw new Error(`Unsupported email provider: ${integration.provider}`);
  }

  return factory((integration.settings ?? {}) as IntegrationSettings, context);
}

export async function getActiveProviderWithSubscribers(
  supabase?: SupabaseClient<Database>
): Promise<{ provider: EmailProvider; subscribers: EmailSubscriber[] }> {
  const client = supabase ?? (await getServerSupabaseClient());
  const integration = await getActiveIntegration(client);
  const provider = instantiateProvider(integration, { supabase: client });
  const subscribers = await provider.listSubscribers();

  return { provider, subscribers };
}
