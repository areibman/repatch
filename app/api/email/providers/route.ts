import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { EmailIntegrationRow, EmailProviderId } from "@/lib/email/types";

const PROVIDER_NAMES: Record<EmailProviderId, string> = {
  resend: "Resend",
  customerio: "Customer.io",
};

const PROVIDER_FIELD_DEFS: Record<EmailProviderId, Array<{ key: string; label: string; type: "text" | "password" | "email" | "select"; required?: boolean; description?: string; options?: Array<{ label: string; value: string }>; }>> = {
  resend: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      required: true,
      description: "Required. Use your Resend secret API key.",
    },
    {
      key: "audienceId",
      label: "Audience ID",
      type: "text",
      description: "Optional. Defaults to the sample audience from Resend docs.",
    },
    {
      key: "fromEmail",
      label: "From Email",
      type: "email",
      description: "Sender identity displayed to subscribers.",
    },
  ],
  customerio: [
    {
      key: "appKey",
      label: "App API Key",
      type: "password",
      required: true,
      description: "Required. Use an App API key with transactional permissions.",
    },
    {
      key: "fromEmail",
      label: "From Email",
      type: "email",
      required: true,
      description: "Sender identity used for transactional messages.",
    },
    {
      key: "region",
      label: "Region",
      type: "select",
      options: [
        { label: "United States", value: "us" },
        { label: "European Union", value: "eu" },
      ],
      description: "Match the region of your Customer.io workspace.",
    },
    {
      key: "siteId",
      label: "Site ID",
      type: "text",
      description: "Required to sync subscribers through the Track API.",
    },
    {
      key: "trackApiKey",
      label: "Track API Key",
      type: "password",
      description: "Needed to add or suppress subscribers from Repatch.",
    },
  ],
};

const VALID_PROVIDERS: EmailProviderId[] = ["resend", "customerio"];

function coerceProvider(value: string | null): EmailProviderId | null {
  return VALID_PROVIDERS.includes(value as EmailProviderId)
    ? (value as EmailProviderId)
    : null;
}

function maskSecret(value?: string | null) {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const trimmed = value.trim();
  return `••••${trimmed.slice(-4)}`;
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function integrationSource(record: EmailIntegrationRow | null, configured: boolean) {
  if (record) {
    return "database";
  }

  return configured ? "environment" : "missing";
}

async function fetchIntegrationMap() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("email_integrations").select("*");

  if (error) {
    throw new Error(error.message || "Failed to load email integrations");
  }

  const records = new Map<EmailProviderId, EmailIntegrationRow>();
  let active: EmailProviderId | null = null;

  for (const row of data ?? []) {
    const providerId = coerceProvider(row.provider);
    if (!providerId) {
      continue;
    }

    records.set(providerId, row);

    if (row.is_active) {
      active = providerId;
    }
  }

  if (!active) {
    if (process.env.RESEND_API_KEY) {
      active = "resend";
    } else if (process.env.CUSTOMERIO_APP_API_KEY) {
      active = "customerio";
    } else {
      active = "resend";
    }
  }

  return { supabase, records, active };
}

function buildResendSummary(record: EmailIntegrationRow | null) {
  const config = record?.config as Record<string, any> | undefined;
  const storedKey = normalizeString(config?.apiKey);
  const envKey = process.env.RESEND_API_KEY;
  const configured = Boolean(storedKey || envKey);

  const audienceId =
    normalizeString(config?.audienceId) ||
    process.env.RESEND_AUDIENCE_ID ||
    undefined;
  const fromEmail =
    normalizeString(config?.fromEmail) ||
    process.env.RESEND_FROM_EMAIL ||
    "Repatch <onboarding@resend.dev>";

  return {
    configured,
    source: integrationSource(record, configured),
    fields: PROVIDER_FIELD_DEFS.resend.map((field) => {
      if (field.key === "apiKey") {
        const secret = storedKey || envKey || null;
        return {
          ...field,
          value: "",
          maskedValue: maskSecret(secret),
        };
      }

      if (field.key === "audienceId") {
        return {
          ...field,
          value: audienceId ?? "",
        };
      }

      if (field.key === "fromEmail") {
        return {
          ...field,
          value: fromEmail ?? "",
        };
      }

      return { ...field, value: "" };
    }),
  };
}

function buildCustomerIoSummary(record: EmailIntegrationRow | null) {
  const config = record?.config as Record<string, any> | undefined;
  const storedAppKey = normalizeString(config?.appKey);
  const envAppKey = process.env.CUSTOMERIO_APP_API_KEY;
  const configured = Boolean(storedAppKey || envAppKey);

  const fromEmail =
    normalizeString(config?.fromEmail) ||
    process.env.CUSTOMERIO_FROM_EMAIL ||
    "Repatch <updates@customer.io>";
  const region =
    (normalizeString(config?.region) || process.env.CUSTOMERIO_REGION || "us")
      .toLowerCase()
      .startsWith("eu")
      ? "eu"
      : "us";
  const siteId =
    normalizeString(config?.siteId) || process.env.CUSTOMERIO_SITE_ID || "";
  const trackApiKey =
    normalizeString(config?.trackApiKey) ||
    process.env.CUSTOMERIO_TRACK_API_KEY ||
    "";

  return {
    configured,
    source: integrationSource(record, configured),
    fields: PROVIDER_FIELD_DEFS.customerio.map((field) => {
      switch (field.key) {
        case "appKey": {
          const secret = storedAppKey || envAppKey || null;
          return {
            ...field,
            value: "",
            maskedValue: maskSecret(secret),
          };
        }
        case "fromEmail":
          return { ...field, value: fromEmail };
        case "region":
          return { ...field, value: region };
        case "siteId":
          return { ...field, value: siteId }; // may be empty string
        case "trackApiKey":
          return {
            ...field,
            value: "",
            maskedValue: maskSecret(trackApiKey),
          };
        default:
          return { ...field, value: "" };
      }
    }),
  };
}

export async function GET() {
  try {
    const { records, active } = await fetchIntegrationMap();

    const providers = VALID_PROVIDERS.map((id) => {
      const record = records.get(id) ?? null;
      const base = {
        id,
        name: PROVIDER_NAMES[id],
        isActive: active === id,
        lastUpdated: record?.updated_at ?? null,
      };

      if (id === "resend") {
        return {
          ...base,
          ...buildResendSummary(record),
        };
      }

      return {
        ...base,
        ...buildCustomerIoSummary(record),
      };
    });

    return NextResponse.json({
      activeProvider: active,
      providers,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load providers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const provider = coerceProvider(body.provider);

    if (!provider) {
      return NextResponse.json(
        { error: "Unsupported email provider" },
        { status: 400 }
      );
    }

    const rawConfig = (body.config ?? {}) as Record<string, unknown>;
    const setActive = Boolean(body.setActive);

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("email_integrations")
      .select("*")
      .eq("provider", provider)
      .maybeSingle();

    const sanitized: Record<string, string> = {};

    for (const field of PROVIDER_FIELD_DEFS[provider]) {
      const value = normalizeString(rawConfig[field.key]);

      if (value === undefined) {
        continue;
      }

      if (field.type === "select" && field.key === "region") {
        sanitized[field.key] = value.toLowerCase() === "eu" ? "eu" : "us";
      } else {
        sanitized[field.key] = value;
      }
    }

    const upsertPayload: Partial<EmailIntegrationRow> & {
      provider: string;
      config: Record<string, string>;
      is_active: boolean;
    } = {
      provider,
      config: sanitized,
      is_active: setActive || Boolean(existing?.is_active),
    };

    if (existing?.id) {
      upsertPayload.id = existing.id;
    }

    if (setActive) {
      await supabase
        .from("email_integrations")
        .update({ is_active: false })
        .neq("provider", provider);
      upsertPayload.is_active = true;
    }

    const { error } = await supabase
      .from("email_integrations")
      .upsert(upsertPayload, { onConflict: "provider" });

    if (error) {
      throw new Error(error.message || "Failed to save provider settings");
    }

    // Recompute summary after persisting changes
    const { records, active } = await fetchIntegrationMap();
    const record = records.get(provider) ?? null;

    const summary =
      provider === "resend"
        ? buildResendSummary(record)
        : buildCustomerIoSummary(record);

    return NextResponse.json({
      provider,
      isActive: active === provider,
      ...summary,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update provider";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
