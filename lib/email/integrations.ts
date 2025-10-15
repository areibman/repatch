import { createClient } from "@/lib/supabase/server";
import { Database } from "@/lib/supabase/database.types";
import {
  EmailIntegrationConfig,
  EmailIntegrationSummary,
  EmailIntegrationSource,
  EmailProviderId,
} from "./types";

const PROVIDER_NAMES: Record<EmailProviderId, string> = {
  resend: "Resend",
  customerio: "Customer.io",
};

function parseCredentials(
  credentials: Database["public"]["Tables"]["email_integrations"]["Row"]["credentials"]
): Record<string, string> {
  if (!credentials || typeof credentials !== "object") {
    return {};
  }

  return Object.entries(credentials).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      if (typeof value === "string") {
        acc[key] = value;
      }
      return acc;
    },
    {}
  );
}

function buildEnvFallbacks(): EmailIntegrationConfig[] {
  const configs: EmailIntegrationConfig[] = [];

  if (process.env.RESEND_API_KEY) {
    configs.push({
      id: "resend",
      credentials: {
        apiKey: process.env.RESEND_API_KEY,
        audienceId: process.env.RESEND_AUDIENCE_ID ?? "",
        fromEmail: process.env.RESEND_FROM_EMAIL ?? "",
      },
      defaultSender: process.env.RESEND_FROM_EMAIL ?? undefined,
      audienceId: process.env.RESEND_AUDIENCE_ID ?? undefined,
      source: "env",
    });
  }

  if (
    process.env.CUSTOMERIO_SITE_ID &&
    (process.env.CUSTOMERIO_APP_API_KEY || process.env.CUSTOMERIO_API_KEY)
  ) {
    configs.push({
      id: "customerio",
      credentials: {
        siteId: process.env.CUSTOMERIO_SITE_ID,
        appApiKey:
          process.env.CUSTOMERIO_APP_API_KEY || process.env.CUSTOMERIO_API_KEY!,
        trackApiKey:
          process.env.CUSTOMERIO_TRACK_API_KEY || process.env.CUSTOMERIO_API_KEY!,
        transactionalMessageId:
          process.env.CUSTOMERIO_TRANSACTIONAL_MESSAGE_ID ?? "",
        fromEmail: process.env.CUSTOMERIO_DEFAULT_FROM ?? "",
      },
      defaultSender: process.env.CUSTOMERIO_DEFAULT_FROM ?? undefined,
      source: "env",
    });
  }

  return configs;
}

export async function fetchEmailIntegrationConfigs(): Promise<{
  configs: EmailIntegrationConfig[];
  active?: EmailProviderId;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_integrations")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load email integrations from Supabase", error);
  }

  const configsFromSupabase: EmailIntegrationConfig[] =
    data?.map((row) => ({
      id: row.provider,
      credentials: parseCredentials(row.credentials),
      defaultSender: row.default_sender ?? undefined,
      audienceId: (row.credentials as any)?.audienceId ?? undefined,
      source: "supabase" as EmailIntegrationSource,
    })) ?? [];

  const active = data?.find((row) => row.is_active)?.provider;

  const envConfigs = buildEnvFallbacks();

  const merged: Record<EmailProviderId, EmailIntegrationConfig> = {} as Record<
    EmailProviderId,
    EmailIntegrationConfig
  >;

  for (const config of envConfigs) {
    merged[config.id] = config;
  }

  for (const config of configsFromSupabase) {
    merged[config.id] = config;
  }

  const configs = Object.values(merged);

  return {
    configs,
    active: active ?? (configs.length === 1 ? configs[0].id : undefined),
  };
}

export async function getActiveEmailIntegration(): Promise<EmailIntegrationConfig | null> {
  const { configs, active } = await fetchEmailIntegrationConfigs();

  if (active) {
    return configs.find((config) => config.id === active) ?? null;
  }

  return configs[0] ?? null;
}

export async function getEmailIntegrationSummaries(): Promise<{
  summaries: EmailIntegrationSummary[];
  active?: EmailProviderId;
}> {
  const { configs, active } = await fetchEmailIntegrationConfigs();

  const summaries = configs.map<EmailIntegrationSummary>((config) => ({
    id: config.id,
    name: PROVIDER_NAMES[config.id],
    isActive: config.id === active,
    defaultSender: config.defaultSender,
    hasCredentials: Object.keys(config.credentials).length > 0,
    source: config.source,
    manageUrl:
      config.id === "resend"
        ? "https://resend.com"
        : "https://fly.customer.io/login",
    audienceId: config.audienceId,
  }));

  return { summaries, active };
}
