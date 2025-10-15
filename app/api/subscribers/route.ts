import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { resolveActiveEmailProvider } from "@/lib/email/service";
import { EmailSubscriber } from "@/lib/email/types";

const createSubscriberSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const updateSubscriberSchema = z.object({
  email: z.string().email(),
  active: z.boolean().optional(),
});

function mapSubscriber(row: {
  id: string;
  email: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}): EmailSubscriber & {
  created_at: string;
  updated_at: string;
} {
  return {
    id: row.id,
    email: row.email,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  const supabase = await createClient();
  const active = await resolveActiveEmailProvider(supabase);

  const { data: supabaseRows, error } = await supabase
    .from("email_subscribers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load subscribers" },
      { status: 500 }
    );
  }

  let subscribers = (supabaseRows ?? []).map(mapSubscriber);
  let source: "database" | "provider" = "database";

  if (
    subscribers.length === 0 &&
    active.provider?.capabilities.canListSubscribers &&
    typeof active.provider.listSubscribers === "function"
  ) {
    try {
      const externalSubscribers = await active.provider.listSubscribers();
      subscribers = externalSubscribers.map((subscriber) => ({
        id: subscriber.id ?? subscriber.email,
        email: subscriber.email,
        active: subscriber.active,
        created_at: subscriber.createdAt ?? new Date().toISOString(),
        updated_at: subscriber.updatedAt ?? new Date().toISOString(),
        createdAt: subscriber.createdAt,
        updatedAt: subscriber.updatedAt,
      }));
      source = "provider";
    } catch (providerError) {
      console.error("Failed to fetch subscribers from provider", providerError);
    }
  }

  return NextResponse.json({
    subscribers,
    provider: active.summary,
    source,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSubscriberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = await createClient();
  const active = await resolveActiveEmailProvider(supabase);

  const { data, error } = await supabase
    .from("email_subscribers")
    .insert({
      email: parsed.data.email,
      active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Email already subscribed" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to add subscriber" },
      { status: 500 }
    );
  }

  if (
    active.provider?.capabilities.canManageSubscribers &&
    typeof active.provider.createSubscriber === "function"
  ) {
    try {
      await active.provider.createSubscriber(parsed.data);
    } catch (providerError) {
      console.error("Provider subscriber create failed", providerError);
    }
  }

  return NextResponse.json({
    subscriber: mapSubscriber(data),
    provider: active.summary,
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = updateSubscriberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = await createClient();
  const active = await resolveActiveEmailProvider(supabase);

  const { data, error } = await supabase
    .from("email_subscribers")
    .update({ active: parsed.data.active ?? true })
    .eq("email", parsed.data.email)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to update subscriber" },
      { status: 500 }
    );
  }

  if (
    active.provider?.capabilities.canManageSubscribers &&
    typeof active.provider.updateSubscriber === "function"
  ) {
    try {
      await active.provider.updateSubscriber({
        email: parsed.data.email,
        active: parsed.data.active,
      });
    } catch (providerError) {
      console.error("Provider subscriber update failed", providerError);
    }
  }

  return NextResponse.json({
    subscriber: mapSubscriber(data),
    provider: active.summary,
  });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { error: "Email query parameter is required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const active = await resolveActiveEmailProvider(supabase);

  const { error } = await supabase
    .from("email_subscribers")
    .delete()
    .eq("email", email);

  if (error) {
    return NextResponse.json(
      { error: "Failed to remove subscriber" },
      { status: 500 }
    );
  }

  if (
    active.provider?.capabilities.canManageSubscribers &&
    typeof active.provider.deleteSubscriber === "function"
  ) {
    try {
      await active.provider.deleteSubscriber(email);
    } catch (providerError) {
      console.error("Provider subscriber delete failed", providerError);
    }
  }

  return NextResponse.json({ success: true });
}
