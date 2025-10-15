import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/supabase/database.types";
import { createEmailProvider } from "./providers";
import {
  EmailIntegrationRecord,
  EmailProvider,
  EmailProviderName,
  EmailProviderSummary,
} from "./types";

const PROVIDER_LABELS: Record<EmailProviderName, string> = {
  resend: "Resend",
  customerio: "Customer.io",
};

type Client = SupabaseClient<Database>;

type ProviderSource = "database" | "environment";

export type ActiveEmailProvider = {
  provider: EmailProvider | null;
  summary: EmailProviderSummary | null;
  record: EmailIntegrationRecord | null;
  source: ProviderSource;
};

export async function listEmailIntegrations(
  supabase: Client
): Promise<EmailIntegrationRecord[]> {
  const { data, error } = await supabase
    .from("email_integrations")
    .select("*")
    .order("provider", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getActiveEmailIntegration(
  supabase: Client
): Promise<EmailIntegrationRecord | null> {
  const { data, error } = await supabase
    .from("email_integrations")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  return data ?? null;
}

function sanitizeConfig(record: EmailIntegrationRecord): EmailProviderSummary {
  const provider = createEmailProvider(record.provider, record.config);
  const fromAddress = provider.getFromAddress();

  const summary: EmailProviderSummary = {
    id: record.provider,
    label: PROVIDER_LABELS[record.provider],
    isActive: record.is_active,
    fromEmail: fromAddress?.email,
    capabilities: provider.capabilities,
    hasApiKey: Boolean(
      (record.config as Record<string, unknown>).apiKey ??
        (record.config as Record<string, unknown>).transactionalApiKey
    ),
    updatedAt: record.updated_at,
    additional: {},
    source: "database",
  };

  if (record.provider === "resend") {
    const cfg = record.config as Record<string, unknown>;
    if (typeof cfg.audienceId === "string") {
      summary.additional!.audienceId = cfg.audienceId;
    }
    if (typeof cfg.replyTo === "string") {
      summary.additional!.replyTo = cfg.replyTo;
    }
    if (typeof cfg.fromName === "string") {
      summary.additional!.fromName = cfg.fromName;
    }
  }

  if (record.provider === "customerio") {
    const cfg = record.config as Record<string, unknown>;
    if (typeof cfg.region === "string") {
      summary.additional!.region = cfg.region;
    }
    if (typeof cfg.transactionalMessageId === "string") {
      summary.additional!.transactionalMessageId = cfg.transactionalMessageId;
    }
    if (typeof cfg.fromName === "string") {
      summary.additional!.fromName = cfg.fromName;
    }
    if (typeof cfg.replyTo === "string") {
      summary.additional!.replyTo = cfg.replyTo;
    }
  }

  return summary;
}

function getEnvironmentFallback(): ActiveEmailProvider {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { provider: null, summary: null, record: null, source: "environment" };
  }

  const config: Record<string, unknown> = {
    apiKey,
    fromEmail: process.env.RESEND_FROM_EMAIL,
    fromName: process.env.RESEND_FROM_NAME,
    replyTo: process.env.RESEND_REPLY_TO,
    audienceId: process.env.RESEND_AUDIENCE_ID,
  };

  const provider = createEmailProvider("resend", config);
  const fromAddress = provider.getFromAddress();
  const additional: Record<string, unknown> = {};
  if (typeof config.audienceId === "string") {
    additional.audienceId = config.audienceId;
  }
  if (typeof config.replyTo === "string") {
    additional.replyTo = config.replyTo;
  }

  const summary: EmailProviderSummary = {
    id: "resend",
    label: PROVIDER_LABELS.resend,
    isActive: true,
    fromEmail: fromAddress?.email,
    capabilities: provider.capabilities,
    hasApiKey: true,
    updatedAt: new Date().toISOString(),
    additional,
    source: "environment",
  };

  return { provider, summary, record: null, source: "environment" };
}

export async function resolveActiveEmailProvider(
  supabase: Client
): Promise<ActiveEmailProvider> {
  const record = await getActiveEmailIntegration(supabase);
  if (record) {
    const provider = createEmailProvider(record.provider, record.config);
    return {
      provider,
      summary: sanitizeConfig(record),
      record,
      source: "database",
    };
  }

  return getEnvironmentFallback();
}

export function summarizeIntegrations(
  records: EmailIntegrationRecord[],
  activeFallback: ActiveEmailProvider | null
): EmailProviderSummary[] {
  const summaries = records.map((record) => sanitizeConfig(record));

  if (
    activeFallback?.summary &&
    activeFallback.source === "environment" &&
    !summaries.some((summary) => summary.id === activeFallback.summary!.id)
  ) {
    summaries.push(activeFallback.summary);
  }

  return summaries;
}

export async function upsertEmailIntegration(
  supabase: Client,
  provider: EmailProviderName,
  config: Record<string, unknown>,
  setActive: boolean
): Promise<EmailIntegrationRecord> {
  const mergedConfig = { ...config };

  const { data: existing } = await supabase
    .from("email_integrations")
    .select("*")
    .eq("provider", provider)
    .maybeSingle();

  if (existing) {
    Object.assign(mergedConfig, existing.config, config);
  }

  const { data, error } = await supabase
    .from("email_integrations")
    .upsert(
      {
        provider,
        config: mergedConfig,
        is_active: setActive ? true : existing?.is_active ?? false,
      },
      { onConflict: "provider" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (setActive) {
    await supabase
      .from("email_integrations")
      .update({ is_active: false })
      .neq("provider", provider);
  }

  return data as EmailIntegrationRecord;
}

export async function setActiveEmailProvider(
  supabase: Client,
  provider: EmailProviderName
): Promise<EmailIntegrationRecord> {
  const { data: existing } = await supabase
    .from("email_integrations")
    .select("*")
    .eq("provider", provider)
    .maybeSingle();

  if (!existing) {
    const { data, error } = await supabase
      .from("email_integrations")
      .insert({ provider, is_active: true, config: {} })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await supabase
      .from("email_integrations")
      .update({ is_active: false })
      .neq("provider", provider);

    return data as EmailIntegrationRecord;
  }

  await supabase
    .from("email_integrations")
    .update({ is_active: true })
    .eq("provider", provider);

  await supabase
    .from("email_integrations")
    .update({ is_active: false })
    .neq("provider", provider);

  const updated = await supabase
    .from("email_integrations")
    .select("*")
    .eq("provider", provider)
    .maybeSingle();

  if (updated.error) {
    throw new Error(updated.error.message);
  }

  return updated.data as EmailIntegrationRecord;
}

export { sanitizeConfig as summarizeIntegration };
