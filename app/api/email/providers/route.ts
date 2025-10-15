import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  listEmailIntegrations,
  resolveActiveEmailProvider,
  setActiveEmailProvider,
  summarizeIntegrations,
  upsertEmailIntegration,
} from "@/lib/email/service";
import { EmailProviderName } from "@/lib/email/types";

const providerEnum = z.enum(["resend", "customerio"]);

const upsertSchema = z.object({
  provider: providerEnum,
  config: z.record(z.string(), z.unknown()).default({}),
  setActive: z.boolean().optional(),
});

const setActiveSchema = z.object({
  provider: providerEnum,
});

function filterConfig(
  provider: EmailProviderName,
  config: Record<string, unknown>
): Record<string, unknown> {
  const allowedKeys: Record<EmailProviderName, string[]> = {
    resend: ["apiKey", "fromEmail", "fromName", "replyTo", "audienceId"],
    customerio: [
      "appApiKey",
      "siteId",
      "region",
      "transactionalApiKey",
      "transactionalMessageId",
      "fromEmail",
      "fromName",
      "replyTo",
    ],
  };

  const allowed = allowedKeys[provider];
  return allowed.reduce<Record<string, unknown>>((acc, key) => {
    const value = config[key];
    if (value === undefined || value === null) {
      return acc;
    }
    if (typeof value === "string") {
      acc[key] = value.trim();
    }
    return acc;
  }, {});
}

export async function GET() {
  const supabase = await createClient();

  try {
    const integrations = await listEmailIntegrations(supabase);
    const active = await resolveActiveEmailProvider(supabase);
    const summaries = summarizeIntegrations(integrations, active);

    return NextResponse.json({
      providers: summaries,
      active: active.summary,
      source: active.source,
    });
  } catch (error) {
    console.error("Failed to load email providers", error);
    return NextResponse.json(
      { error: "Failed to load email providers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = await createClient();
  const filteredConfig = filterConfig(parsed.data.provider, parsed.data.config);

  try {
    const record = await upsertEmailIntegration(
      supabase,
      parsed.data.provider,
      filteredConfig,
      parsed.data.setActive ?? false
    );

    const active = await resolveActiveEmailProvider(supabase);

    return NextResponse.json({
      provider: record ? summarizeIntegrations([record], null)[0] : null,
      active: active.summary,
    });
  } catch (error) {
    console.error("Failed to save provider", error);
    return NextResponse.json(
      { error: "Failed to save provider configuration" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = setActiveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    const record = await setActiveEmailProvider(supabase, parsed.data.provider);
    const active = await resolveActiveEmailProvider(supabase);

    return NextResponse.json({
      provider: summarizeIntegrations([record], null)[0],
      active: active.summary,
    });
  } catch (error) {
    console.error("Failed to activate provider", error);
    return NextResponse.json(
      { error: "Failed to activate provider" },
      { status: 500 }
    );
  }
}
