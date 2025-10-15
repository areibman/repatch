import { SupabaseClient } from "@supabase/supabase-js";

import { Database } from "@/lib/supabase/database.types";

import { EmailProviderError } from "./errors";
import { getProviderMetadata } from "./metadata";
import {
  EmailIntegrationConfig,
  EmailIntegrationSource,
  EmailProvider,
  EmailProviderId,
  SanitizedIntegrationConfig,
} from "./types";
import { CustomerIoProvider } from "./providers/customer-io";
import { ResendProvider } from "./providers/resend";
import { MockEmailProvider } from "./providers/mock";

type EmailIntegrationRow = Database["public"]["Tables"]["email_integrations"]["Row"];

type IntegrationPayload = {
  provider: EmailProviderId;
  config?: Record<string, unknown>;
  fromEmail?: string | null;
  isActive?: boolean;
};

const PROVIDER_REQUIRED_KEYS: Record<EmailProviderId, string[]> = {
  resend: ["apiKey"],
  customerio: ["siteId", "apiKey", "appKey", "transactionalMessageId"],
};

const ENV_CONFIG_LOADERS: Record<EmailProviderId, () => EmailIntegrationConfig | null> = {
  resend: () => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return null;

    return {
      provider: "resend",
      fromEmail: process.env.RESEND_FROM_EMAIL || getProviderMetadata("resend").defaultFromEmail,
      config: {
        apiKey,
        audienceId: process.env.RESEND_AUDIENCE_ID,
      },
      isActive: true,
      source: "environment",
      configured: true,
    };
  },
  customerio: () => {
    const siteId = process.env.CUSTOMER_IO_SITE_ID;
    const apiKey = process.env.CUSTOMER_IO_API_KEY;
    const appKey = process.env.CUSTOMER_IO_APP_KEY;
    const transactionalMessageId = process.env.CUSTOMER_IO_TRANSACTIONAL_MESSAGE_ID;

    if (!siteId || !apiKey || !appKey || !transactionalMessageId) {
      return null;
    }

    return {
      provider: "customerio",
      fromEmail: process.env.CUSTOMER_IO_FROM_EMAIL || null,
      config: {
        siteId,
        apiKey,
        appKey,
        transactionalMessageId,
        region: process.env.CUSTOMER_IO_REGION || "us",
      },
      isActive: false,
      source: "environment",
      configured: true,
    };
  },
};

function normalizeRow(row: EmailIntegrationRow): EmailIntegrationConfig {
  return {
    id: row.id,
    provider: row.provider,
    fromEmail: row.from_email,
    config: (row.config as Record<string, unknown>) || {},
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: "database",
    configured: isConfigured(row.provider, (row.config as Record<string, unknown>) || {}),
  };
}

function isConfigured(provider: EmailProviderId, config: Record<string, unknown>): boolean {
  return PROVIDER_REQUIRED_KEYS[provider].every((key) => Boolean(config[key]));
}

export function sanitizeIntegration(
  integration: EmailIntegrationConfig
): SanitizedIntegrationConfig {
  const metadata = getProviderMetadata(integration.provider);
  const config = { ...integration.config };

  for (const secret of metadata.secretKeys) {
    if (secret in config) {
      delete config[secret];
    }
  }

  for (const key of Object.keys(config)) {
    if (!metadata.safeConfigKeys.includes(key)) {
      delete config[key];
    }
  }

  return {
    provider: integration.provider,
    label: metadata.label,
    isActive: integration.isActive,
    configured: integration.configured,
    fromEmail: integration.fromEmail ?? null,
    config,
    source: integration.source,
    dashboardUrl: metadata.dashboardUrl,
    supportsAudienceManagement: metadata.supportsAudienceManagement,
  };
}

export async function loadEmailIntegrations(
  supabase: SupabaseClient<Database> | null
): Promise<EmailIntegrationConfig[]> {
  if (process.env.EMAIL_PROVIDER_MOCK === "true") {
    return [
      {
        provider: "resend",
        fromEmail: "mock@repatch.test",
        config: { audienceId: "mock-audience" },
        isActive: true,
        source: "environment",
        configured: true,
      },
    ];
  }

  const integrations: EmailIntegrationConfig[] = [];

  if (supabase) {
    const { data, error } = await supabase.from("email_integrations").select("*");
    if (error) {
      console.error("Failed to load email integrations from Supabase", error);
    } else if (data) {
      integrations.push(...data.map(normalizeRow));
    }
  }

  for (const provider of Object.keys(ENV_CONFIG_LOADERS) as EmailProviderId[]) {
    const existing = integrations.find((integration) => integration.provider === provider);
    if (!existing) {
      const envConfig = ENV_CONFIG_LOADERS[provider]();
      if (envConfig) {
        integrations.push(envConfig);
      }
    }
  }

  if (!integrations.some((integration) => integration.isActive)) {
    const resendIntegration = integrations.find((integration) => integration.provider === "resend");
    if (resendIntegration) {
      resendIntegration.isActive = true;
    }
  }

  return integrations;
}

export function getActiveIntegration(
  integrations: EmailIntegrationConfig[]
): EmailIntegrationConfig | null {
  const active = integrations.find((integration) => integration.isActive);
  if (active) return active;
  return integrations[0] ?? null;
}

export function createEmailProvider(
  integration: EmailIntegrationConfig | null
): EmailProvider {
  if (process.env.EMAIL_PROVIDER_MOCK === "true") {
    return new MockEmailProvider({
      id: (integration?.provider as EmailProviderId | undefined) ?? "resend",
      fromEmail: integration?.fromEmail ?? undefined,
    });
  }

  if (!integration) {
    throw new EmailProviderError(
      "No email provider configuration is available.",
      "MISSING_CONFIGURATION"
    );
  }

  const { provider, config, fromEmail } = integration;

  switch (provider) {
    case "resend":
      return new ResendProvider({
        apiKey: config.apiKey as string | undefined,
        audienceId: config.audienceId as string | undefined,
        fromEmail: fromEmail ?? null,
      });
    case "customerio":
      return new CustomerIoProvider({
        siteId: config.siteId as string | undefined,
        apiKey: config.apiKey as string | undefined,
        appKey: config.appKey as string | undefined,
        transactionalMessageId: config.transactionalMessageId as string | undefined,
        region: (config.region as string | undefined) || "us",
        fromEmail: fromEmail ?? null,
      });
    default:
      throw new EmailProviderError(
        `Unsupported email provider: ${provider}.`,
        "UNSUPPORTED_OPERATION"
      );
  }
}

export async function saveEmailIntegration(
  supabase: SupabaseClient<Database>,
  payload: IntegrationPayload
): Promise<EmailIntegrationConfig> {
  const config = payload.config ?? {};
  const cleanedConfig = Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined && value !== "")
  );

  const upsertPayload = {
    provider: payload.provider,
    from_email: payload.fromEmail ?? null,
    config: cleanedConfig,
    is_active: payload.isActive ?? false,
  };

  const { data, error } = await supabase
    .from("email_integrations")
    .upsert(upsertPayload, { onConflict: "provider" })
    .select("*")
    .single();

  if (error || !data) {
    throw new EmailProviderError("Failed to save email integration.", "REQUEST_FAILED", { cause: error });
  }

  if (payload.isActive) {
    await supabase
      .from("email_integrations")
      .update({ is_active: false })
      .neq("provider", payload.provider);
  }

  return normalizeRow(data);
}

export async function deactivateOtherIntegrations(
  supabase: SupabaseClient<Database>,
  provider: EmailProviderId
) {
  await supabase
    .from("email_integrations")
    .update({ is_active: false })
    .neq("provider", provider);
}

export function validateIntegrationPayload(payload: IntegrationPayload) {
  const requiredKeys = PROVIDER_REQUIRED_KEYS[payload.provider];
  if (!requiredKeys) {
    throw new EmailProviderError(
      `Unsupported provider: ${payload.provider}.`,
      "UNSUPPORTED_OPERATION"
    );
  }

  const config = payload.config ?? {};
  for (const key of requiredKeys) {
    if (!config[key]) {
      throw new EmailProviderError(
        `Missing required field ${key} for ${payload.provider}.`,
        "MISSING_CONFIGURATION"
      );
    }
  }
}

export function integrationSource(integration: EmailIntegrationConfig): EmailIntegrationSource {
  return integration.source;
}
