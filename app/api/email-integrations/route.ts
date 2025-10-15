import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  getActiveIntegration,
  loadEmailIntegrations,
  sanitizeIntegration,
  saveEmailIntegration,
  validateIntegrationPayload,
} from "@/lib/email/registry";
import { EmailProviderError } from "@/lib/email/errors";
import { EmailProviderId } from "@/lib/email/types";

async function getSupabaseClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  try {
    return await createClient();
  } catch (error) {
    console.warn("Supabase client unavailable", error);
    return null;
  }
}

export async function GET() {
  const supabase = await getSupabaseClient();
  const integrations = await loadEmailIntegrations(supabase);
  const active = getActiveIntegration(integrations);

  return NextResponse.json({
    providers: integrations.map(sanitizeIntegration),
    activeProvider: active ? sanitizeIntegration(active) : null,
  });
}

const bodySchema = z.object({
  provider: z.enum(["resend", "customerio"] satisfies EmailProviderId[]),
  config: z.record(z.any()).optional(),
  fromEmail: z.union([z.string().min(1), z.null()]).optional(),
  setActive: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured for this environment." },
      { status: 500 }
    );
  }

  try {
    const json = await request.json();
    const body = bodySchema.parse(json);

    validateIntegrationPayload({
      provider: body.provider,
      config: body.config,
      fromEmail: body.fromEmail,
      isActive: body.setActive,
    });

    const saved = await saveEmailIntegration(supabase, {
      provider: body.provider,
      config: body.config,
      fromEmail: body.fromEmail,
      isActive: body.setActive,
    });

    if (body.setActive) {
      await supabase
        .from("email_integrations")
        .update({ is_active: false })
        .neq("provider", body.provider);
    }

    const integrations = await loadEmailIntegrations(supabase);
    const active = getActiveIntegration(integrations);

    return NextResponse.json({
      provider: sanitizeIntegration(saved),
      providers: integrations.map(sanitizeIntegration),
      activeProvider: active ? sanitizeIntegration(active) : null,
    });
  } catch (error) {
    if (error instanceof EmailProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    console.error("Failed to save email integration", error);
    return NextResponse.json(
      { error: "Failed to save email integration." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured for this environment." },
      { status: 500 }
    );
  }

  try {
    const { provider } = (await request.json()) as { provider: EmailProviderId };
    if (!provider) {
      return NextResponse.json({ error: "Provider is required." }, { status: 400 });
    }

    await supabase
      .from("email_integrations")
      .update({ is_active: true })
      .eq("provider", provider);

    await supabase
      .from("email_integrations")
      .update({ is_active: false })
      .neq("provider", provider);

    const integrations = await loadEmailIntegrations(supabase);
    const active = getActiveIntegration(integrations);

    return NextResponse.json({
      providers: integrations.map(sanitizeIntegration),
      activeProvider: active ? sanitizeIntegration(active) : null,
    });
  } catch (error) {
    console.error("Failed to activate provider", error);
    return NextResponse.json(
      { error: "Failed to activate provider." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured for this environment." },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider") as EmailProviderId | null;

    if (!provider) {
      return NextResponse.json({ error: "Provider is required." }, { status: 400 });
    }

    await supabase.from("email_integrations").delete().eq("provider", provider);

    const integrations = await loadEmailIntegrations(supabase);
    const active = getActiveIntegration(integrations);

    return NextResponse.json({
      providers: integrations.map(sanitizeIntegration),
      activeProvider: active ? sanitizeIntegration(active) : null,
    });
  } catch (error) {
    console.error("Failed to delete provider", error);
    return NextResponse.json(
      { error: "Failed to delete provider." },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function HEAD() {
  const supabase = await getSupabaseClient();
  const integrations = await loadEmailIntegrations(supabase);
  const active = getActiveIntegration(integrations);

  return NextResponse.json({
    active: active ? active.provider : null,
  });
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Use POST to update provider configuration." },
    { status: 405 }
  );
}
