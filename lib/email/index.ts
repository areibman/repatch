import { createClient } from "@/lib/supabase/server";

import {
  createCustomerIoProvider,
} from "@/lib/email/providers/customerio";
import {
  RESEND_DEFAULT_AUDIENCE_ID,
  createResendProvider,
} from "@/lib/email/providers/resend";
import type {
  CustomerIoProviderConfig,
  EmailIntegrationRow,
  EmailProvider,
  EmailProviderId,
  ProviderRuntimeConfig,
  ResendProviderConfig,
  TypedSupabaseClient,
} from "@/lib/email/types";

type ProviderSource = "database" | "environment";

const PROVIDER_IDS: EmailProviderId[] = ["resend", "customerio"];

function normalizeRecordConfig(
  record?: EmailIntegrationRow | null
): Record<string, any> {
  if (!record?.config || typeof record.config !== "object") {
    return {};
  }

  return record.config as Record<string, any>;
}

export function resolveResendConfig(
  record?: EmailIntegrationRow | null
): ResendProviderConfig {
  const config = normalizeRecordConfig(record);

  const apiKey = (config.apiKey as string) ?? process.env.RESEND_API_KEY;
  const audienceId =
    (config.audienceId as string) ??
    process.env.RESEND_AUDIENCE_ID ??
    RESEND_DEFAULT_AUDIENCE_ID;
  const fromEmail =
    (config.fromEmail as string) ??
    process.env.RESEND_FROM_EMAIL ??
    "Repatch <onboarding@resend.dev>";

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new Error("Resend API key is not configured");
  }

  return {
    apiKey: apiKey.trim(),
    audienceId: audienceId.trim(),
    fromEmail: fromEmail.trim(),
  };
}

export function resolveCustomerIoConfig(
  record?: EmailIntegrationRow | null
): CustomerIoProviderConfig {
  const config = normalizeRecordConfig(record);

  const rawRegion =
    (config.region as string) ?? process.env.CUSTOMERIO_REGION ?? "us";
  const region = rawRegion.toLowerCase() === "eu" ? "eu" : "us";

  const appKey =
    (config.appKey as string) ?? process.env.CUSTOMERIO_APP_API_KEY ?? "";
  const fromEmail =
    (config.fromEmail as string) ??
    process.env.CUSTOMERIO_FROM_EMAIL ??
    "Repatch <updates@customer.io>";
  const siteId =
    (config.siteId as string) ?? process.env.CUSTOMERIO_SITE_ID ?? null;
  const trackApiKey =
    (config.trackApiKey as string) ??
    process.env.CUSTOMERIO_TRACK_API_KEY ??
    null;

  if (!appKey || typeof appKey !== "string" || appKey.trim().length === 0) {
    throw new Error("Customer.io App API key is not configured");
  }

  return {
    appKey: appKey.trim(),
    fromEmail: fromEmail.trim(),
    region,
    siteId: siteId ? String(siteId).trim() : null,
    trackApiKey: trackApiKey ? String(trackApiKey).trim() : null,
  };
}

function coerceProviderId(provider?: string | null): EmailProviderId | null {
  return PROVIDER_IDS.includes(provider as EmailProviderId)
    ? (provider as EmailProviderId)
    : null;
}

export interface ActiveEmailProvider {
  provider: EmailProvider;
  supabase: TypedSupabaseClient;
  runtimeConfig: ProviderRuntimeConfig;
  integration: EmailIntegrationRow | null;
  source: ProviderSource;
  integrations: EmailIntegrationRow[];
}

export async function resolveActiveEmailProvider(): Promise<ActiveEmailProvider> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_integrations")
    .select("*");

  if (error) {
    throw new Error(error.message || "Failed to load email integrations");
  }

  const integrations = (data ?? []).filter((row) =>
    coerceProviderId(row.provider)
  );

  const activeRecord =
    integrations.find((row) => row.is_active) ?? null;

  let providerId: EmailProviderId;
  let source: ProviderSource = activeRecord ? "database" : "environment";

  if (activeRecord) {
    providerId = coerceProviderId(activeRecord.provider) ?? "resend";
  } else if (process.env.CUSTOMERIO_APP_API_KEY && !process.env.RESEND_API_KEY) {
    providerId = "customerio";
  } else {
    providerId = "resend";
  }

  const runtimeConfig: ProviderRuntimeConfig = {};
  let provider: EmailProvider;

  if (providerId === "resend") {
    const config = resolveResendConfig(activeRecord);
    runtimeConfig.resend = config;
    provider = createResendProvider(config);
  } else {
    const config = resolveCustomerIoConfig(activeRecord);
    runtimeConfig.customerio = config;
    provider = createCustomerIoProvider(config, supabase, activeRecord ?? undefined);
  }

  return {
    provider,
    supabase,
    runtimeConfig,
    integration: activeRecord,
    source,
    integrations,
  };
}
