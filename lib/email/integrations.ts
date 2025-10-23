import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  CustomerIoSettings,
  EmailIntegrationConfig,
  EmailProvider,
  ProviderSettingsMap,
  ResendSettings,
} from "@/types/email";

const PROVIDERS: EmailProvider[] = ["resend", "customerio"];

type TypedClient = SupabaseClient<Database>;

type EmailIntegrationRow = Database["public"]["Tables"]["email_integrations"]["Row"];

type SettingsRecord = Record<string, unknown> | null | undefined;

function createDefaultSettings(): ProviderSettingsMap {
  return {
    resend: {
      apiKey: null,
      audienceId: null,
      replyTo: null,
      fromEmail: null,
      fromName: null,
    },
    customerio: {
      appApiKey: null,
      region: null,
      fromEmail: null,
      fromName: null,
    },
  };
}

function mapResendSettings(settings: SettingsRecord): ResendSettings {
  const defaults = createDefaultSettings().resend;
  if (!settings || typeof settings !== "object") {
    return defaults;
  }

  return {
    ...defaults,
    apiKey: (settings.apiKey as string | null | undefined) ?? defaults.apiKey,
    audienceId:
      (settings.audienceId as string | null | undefined) ?? defaults.audienceId,
    replyTo: (settings.replyTo as string | null | undefined) ?? defaults.replyTo,
    fromEmail:
      (settings.fromEmail as string | null | undefined) ?? defaults.fromEmail,
    fromName:
      (settings.fromName as string | null | undefined) ?? defaults.fromName,
  };
}

function mapCustomerIoSettings(settings: SettingsRecord): CustomerIoSettings {
  const defaults = createDefaultSettings().customerio;

  if (!settings || typeof settings !== "object") {
    return defaults;
  }

  const rawRegion = settings.region as string | null | undefined;
  const normalizedRegion = rawRegion === "eu" ? "eu" : rawRegion === "us" ? "us" : null;

  return {
    ...defaults,
    appApiKey:
      (settings.appApiKey as string | null | undefined) ?? defaults.appApiKey,
    region: normalizedRegion ?? defaults.region,
    fromEmail:
      (settings.fromEmail as string | null | undefined) ?? defaults.fromEmail,
    fromName:
      (settings.fromName as string | null | undefined) ?? defaults.fromName,
  };
}

function mapRowToConfig(row: EmailIntegrationRow): EmailIntegrationConfig {
  if (row.provider === "resend") {
    return {
      id: row.id,
      provider: "resend",
      isActive: row.is_active,
      settings: mapResendSettings(row.settings as SettingsRecord),
      source: "database",
    };
  }

  return {
    id: row.id,
    provider: "customerio",
    isActive: row.is_active,
    settings: mapCustomerIoSettings(row.settings as SettingsRecord),
    source: "database",
  };
}

function envResendConfig(): EmailIntegrationConfig | null {
  const apiKey = process.env.RESEND_API_KEY ?? null;
  const audienceId = process.env.RESEND_AUDIENCE_ID ?? null;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? null;
  const fromName = process.env.RESEND_FROM_NAME ?? null;
  const replyTo = process.env.RESEND_REPLY_TO ?? null;

  if (!apiKey && !audienceId && !fromEmail && !fromName && !replyTo) {
    return null;
  }

  return {
    provider: "resend",
    isActive: Boolean(apiKey),
    settings: {
      apiKey,
      audienceId,
      replyTo,
      fromEmail,
      fromName,
    } satisfies ResendSettings,
    source: "environment",
  };
}

function envCustomerIoConfig(): EmailIntegrationConfig | null {
  const apiKey = process.env.CUSTOMERIO_APP_API_KEY ?? null;
  const region = process.env.CUSTOMERIO_REGION ?? null;
  const fromEmail = process.env.CUSTOMERIO_FROM_EMAIL ?? null;
  const fromName = process.env.CUSTOMERIO_FROM_NAME ?? null;

  if (!apiKey && !region && !fromEmail && !fromName) {
    return null;
  }

  return {
    provider: "customerio",
    isActive: Boolean(apiKey),
    settings: {
      appApiKey: apiKey,
      region: region === "eu" ? "eu" : region === "us" ? "us" : null,
      fromEmail,
      fromName,
    } satisfies CustomerIoSettings,
    source: "environment",
  };
}

function ensureAllProviders(configs: Map<EmailProvider, EmailIntegrationConfig>) {
  const defaults = createDefaultSettings();
  for (const provider of PROVIDERS) {
    if (!configs.has(provider)) {
      configs.set(provider, {
        provider,
        isActive: false,
        settings: defaults[provider],
        source: "fallback",
      });
    }
  }
}

export async function listEmailIntegrations(
  client: TypedClient
): Promise<EmailIntegrationConfig[]> {
  const { data, error } = await client
    .from("email_integrations")
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  const configs = new Map<EmailProvider, EmailIntegrationConfig>();
  let hasDatabaseActive = false;

  for (const row of data ?? []) {
    const config = mapRowToConfig(row);
    configs.set(row.provider, config);
    if (config.isActive) {
      hasDatabaseActive = true;
    }
  }

  const envConfigs = [envResendConfig(), envCustomerIoConfig()].filter(
    Boolean
  ) as EmailIntegrationConfig[];

  for (const envConfig of envConfigs) {
    if (!configs.has(envConfig.provider)) {
      configs.set(envConfig.provider, { ...envConfig });
    }
  }

  ensureAllProviders(configs);

  if (!hasDatabaseActive) {
    const resendConfig = configs.get("resend");
    if (
      resendConfig &&
      resendConfig.source !== "fallback" &&
      (resendConfig.settings as ResendSettings).apiKey
    ) {
      resendConfig.isActive = true;
    }
  }

  return Array.from(configs.values());
}

export async function getActiveEmailIntegration(
  client: TypedClient
): Promise<EmailIntegrationConfig | null> {
  const configs = await listEmailIntegrations(client);
  const active = configs.find((config) => config.isActive);
  return active ?? null;
}

export function mergeSettings<T extends ProviderSettingsMap[keyof ProviderSettingsMap]>(
  existing: T,
  updates: Partial<T>
): T {
  return { ...existing, ...updates };
}

export function getDefaultProviderSettings<P extends EmailProvider>(
  provider: P
): ProviderSettingsMap[P] {
  const defaults = createDefaultSettings();
  return defaults[provider];
}
