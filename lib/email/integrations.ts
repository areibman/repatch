import type { SupabaseClient } from "@supabase/supabase-js";
import { createCustomerIoProvider } from "@/lib/email/providers/customer-io";
import { createResendProvider } from "@/lib/email/providers/resend";
import type {
  EmailIntegrationSettings,
  EmailProvider,
  EmailProviderDependencies,
  EmailProviderName,
} from "@/lib/email/types";
import type { Database, Json } from "@/lib/supabase/database.types";

export type EmailIntegrationRow = Database["public"]["Tables"]["email_integrations"]["Row"];

type ProviderDefaults = {
  apiKey?: string;
  fromEmail?: string;
  audienceId?: string;
  siteId?: string;
  trackApiKey?: string;
  transactionalMessageId?: string;
  metadata?: Record<string, Json>;
};

const DEFAULT_RESEND_FROM = "Repatch <onboarding@resend.dev>";
const DEFAULT_RESEND_AUDIENCE =
  process.env.RESEND_AUDIENCE_ID ?? "fa2a9141-3fa1-4d41-a873-5883074e6516";

function getEnvDefaults(provider: EmailProviderName): ProviderDefaults {
  if (provider === "customer_io") {
    return {
      apiKey: process.env.CUSTOMER_IO_APP_API_KEY,
      fromEmail:
        process.env.CUSTOMER_IO_FROM_EMAIL ||
        process.env.RESEND_FROM_EMAIL ||
        DEFAULT_RESEND_FROM,
      siteId: process.env.CUSTOMER_IO_SITE_ID,
      trackApiKey: process.env.CUSTOMER_IO_TRACK_API_KEY,
      transactionalMessageId: process.env.CUSTOMER_IO_TRANSACTIONAL_MESSAGE_ID,
      metadata: process.env.CUSTOMER_IO_REGION
        ? { region: process.env.CUSTOMER_IO_REGION }
        : undefined,
    };
  }

  return {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL || DEFAULT_RESEND_FROM,
    audienceId: process.env.RESEND_AUDIENCE_ID || DEFAULT_RESEND_AUDIENCE,
  };
}

export function normalizeIntegration(
  row: EmailIntegrationRow | null,
  provider: EmailProviderName
): EmailIntegrationSettings | null {
  const envDefaults = getEnvDefaults(provider);

  if (!row) {
    if (!envDefaults.apiKey) {
      return null;
    }

    return {
      id: `${provider}-env`,
      provider,
      displayName: provider === "resend" ? "Resend" : "Customer.io",
      fromEmail: envDefaults.fromEmail ?? DEFAULT_RESEND_FROM,
      apiKey: envDefaults.apiKey,
      audienceId: envDefaults.audienceId,
      siteId: envDefaults.siteId,
      trackApiKey: envDefaults.trackApiKey,
      transactionalMessageId: envDefaults.transactionalMessageId,
      metadata: envDefaults.metadata,
      isActive: true,
    };
  }

  return {
    id: row.id,
    provider: row.provider,
    displayName: row.display_name,
    fromEmail:
      row.from_email ?? envDefaults.fromEmail ?? DEFAULT_RESEND_FROM,
    apiKey: row.api_key ?? envDefaults.apiKey ?? "",
    audienceId: row.audience_id ?? envDefaults.audienceId,
    siteId: row.site_id ?? envDefaults.siteId,
    trackApiKey: row.track_api_key ?? envDefaults.trackApiKey,
    transactionalMessageId:
      row.transactional_message_id ?? envDefaults.transactionalMessageId,
    metadata:
      (row.metadata as Record<string, Json> | null | undefined) ??
      envDefaults.metadata,
    isActive: row.is_active,
  };
}

export async function fetchIntegrationRows(
  supabase: SupabaseClient<Database>
): Promise<EmailIntegrationRow[]> {
  const { data, error } = await supabase
    .from("email_integrations")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load email integrations");
  }

  return data ?? [];
}

export async function getActiveIntegration(
  supabase: SupabaseClient<Database>
): Promise<EmailIntegrationSettings> {
  const rows = await fetchIntegrationRows(supabase);
  const active = rows.find((row) => row.is_active) ?? rows[0] ?? null;

  const normalized = normalizeIntegration(active ?? null, active?.provider ?? "resend");

  if (normalized) {
    return normalized;
  }

  const fallback = normalizeIntegration(null, "resend");

  if (!fallback) {
    throw new Error("No email provider configured");
  }

  return fallback;
}

export function createEmailProvider(
  config: EmailIntegrationSettings,
  deps: EmailProviderDependencies
): EmailProvider {
  if (config.provider === "customer_io") {
    return createCustomerIoProvider(config, deps);
  }

  return createResendProvider(config);
}

export async function getEmailProvider(
  supabase: SupabaseClient<Database>,
  deps: EmailProviderDependencies = {}
): Promise<EmailProvider> {
  const config = await getActiveIntegration(supabase);
  return createEmailProvider(config, { ...deps, supabase });
}

export function summarizeIntegration(
  config: EmailIntegrationSettings
) {
  return {
    id: config.id,
    provider: config.provider,
    displayName: config.displayName,
    fromEmail: config.fromEmail,
    hasApiKey: Boolean(config.apiKey),
    audienceId: config.audienceId,
    siteId: config.siteId,
    transactionalMessageId: config.transactionalMessageId,
    metadata: config.metadata ?? {},
    isActive: Boolean(config.isActive),
  };
}
