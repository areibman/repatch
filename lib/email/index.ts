import { createClient } from "@/lib/supabase/server";
import { Database } from "@/lib/supabase/database.types";
import { CustomerIOEmailProvider } from "./providers/customerio";
import { ResendEmailProvider } from "./providers/resend";
import {
  EmailIntegrationRecord,
  EmailProvider,
  EmailProviderName,
  SanitizedEmailIntegration,
  SendEmailPayload,
} from "./types";

export type { EmailIntegrationRecord, EmailProviderName } from "./types";

type EmailIntegrationRow =
  Database["public"]["Tables"]["email_integrations"]["Row"];

type EmailProviderCredentials = Record<string, unknown>;

const RESEND_AUDIENCE_FALLBACK = "fa2a9141-3fa1-4d41-a873-5883074e6516";

function mapRowToIntegration(row: EmailIntegrationRow): EmailIntegrationRecord {
  return {
    id: row.id,
    provider: row.provider,
    fromEmail: row.from_email,
    credentials: (row.credentials as EmailProviderCredentials) ?? {},
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getEnvFallbackIntegration(): EmailIntegrationRecord | null {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return null;
  }

  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "Repatch <updates@example.com>";
  const audienceId =
    process.env.RESEND_AUDIENCE_ID ?? RESEND_AUDIENCE_FALLBACK;

  return {
    provider: "resend",
    fromEmail,
    credentials: {
      apiKey,
      audienceId,
    },
    isActive: true,
    isFallback: true,
  };
}

export function sanitizeIntegration(
  integration: EmailIntegrationRecord
): SanitizedEmailIntegration {
  return {
    provider: integration.provider,
    fromEmail: integration.fromEmail,
    isActive: integration.isActive,
    updatedAt: integration.updatedAt,
    manageUrl:
      integration.provider === "resend"
        ? "https://resend.com"
        : "https://fly.customer.io/",
    isFallback: integration.isFallback,
  };
}

export function resolveActiveIntegration(
  integrations: EmailIntegrationRecord[],
  fallbackIntegration: EmailIntegrationRecord | null
): EmailIntegrationRecord | null {
  const active = integrations.find((integration) => integration.isActive);
  if (active) {
    return active;
  }

  if (fallbackIntegration) {
    return fallbackIntegration;
  }

  if (integrations.length > 0) {
    return integrations[0];
  }

  return null;
}

export async function fetchEmailIntegrations(): Promise<
  EmailIntegrationRecord[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("email_integrations").select();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRowToIntegration);
}

export function createEmailProviderFromIntegration(
  integration: EmailIntegrationRecord
): EmailProvider {
  switch (integration.provider) {
    case "resend": {
      const credentials = integration.credentials as {
        apiKey: string;
        audienceId?: string;
      };

      if (!credentials?.apiKey) {
        throw new Error("Resend provider is missing an API key");
      }

      const audienceId = credentials.audienceId ?? RESEND_AUDIENCE_FALLBACK;

      return new ResendEmailProvider({
        apiKey: credentials.apiKey,
        audienceId,
        fromEmail: integration.fromEmail,
      });
    }
    case "customerio": {
      const credentials = integration.credentials as {
        siteId?: string;
        apiKey?: string;
        appKey?: string;
        transactionalMessageId?: string;
        region?: "us" | "eu";
      };

      if (
        !credentials?.siteId ||
        !credentials?.apiKey ||
        !credentials?.appKey ||
        !credentials?.transactionalMessageId
      ) {
        throw new Error("Customer.io provider is missing required credentials");
      }

      return new CustomerIOEmailProvider({
        siteId: credentials.siteId,
        apiKey: credentials.apiKey,
        appKey: credentials.appKey,
        transactionalMessageId: credentials.transactionalMessageId,
        fromEmail: integration.fromEmail,
        region: credentials.region,
      });
    }
    default:
      throw new Error(`Unsupported email provider: ${integration.provider}` satisfies never);
  }
}

export async function getEmailProvider(): Promise<EmailProvider> {
  const fallback = getEnvFallbackIntegration();
  let integrations: EmailIntegrationRecord[] = [];

  try {
    integrations = await fetchEmailIntegrations();
  } catch (error) {
    if (!fallback) {
      throw error;
    }
  }

  const activeIntegration = resolveActiveIntegration(integrations, fallback);

  if (!activeIntegration) {
    throw new Error("No active email provider configured");
  }

  return createEmailProviderFromIntegration(activeIntegration);
}

export async function getSanitizedIntegrations(): Promise<{
  active: SanitizedEmailIntegration | null;
  integrations: SanitizedEmailIntegration[];
}> {
  const fallback = getEnvFallbackIntegration();
  let integrations: EmailIntegrationRecord[] = [];

  try {
    integrations = await fetchEmailIntegrations();
  } catch (error) {
    integrations = [];
  }

  const records = integrations.map(sanitizeIntegration);

  if (
    fallback &&
    !integrations.some((integration) => integration.provider === fallback.provider)
  ) {
    records.push(sanitizeIntegration(fallback));
  }

  const active = resolveActiveIntegration(integrations, fallback);

  return {
    active: active ? sanitizeIntegration(active) : null,
    integrations: records,
  };
}

export async function sendWithActiveProvider(
  payload: SendEmailPayload
): Promise<{
  provider: EmailProviderName;
  result: Awaited<ReturnType<EmailProvider["sendCampaign"]>>;
}> {
  const provider = await getEmailProvider();
  const result = await provider.sendCampaign(payload);
  return { provider: provider.name, result };
}
