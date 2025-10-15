import { NextRequest, NextResponse } from "next/server";

import {
  createEmailProvider,
  getActiveIntegration,
  loadEmailIntegrations,
} from "@/lib/email/registry";
import { EmailProviderError } from "@/lib/email/errors";
import { createClient } from "@/lib/supabase/server";
import { EmailSubscriber } from "@/lib/email/types";

async function resolveProvider() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new EmailProviderError(
      "Supabase configuration is required to resolve the email provider.",
      "MISSING_CONFIGURATION"
    );
  }

  const supabase = await createClient();
  const integrations = await loadEmailIntegrations(supabase);
  const active = getActiveIntegration(integrations);
  const provider = createEmailProvider(active);
  return provider;
}

function formatSubscriber(subscriber: EmailSubscriber) {
  return {
    id: subscriber.id,
    email: subscriber.email,
    active: subscriber.active,
    created_at: subscriber.createdAt ?? new Date().toISOString(),
    updated_at: subscriber.updatedAt ?? new Date().toISOString(),
  };
}

// GET /api/subscribers - Fetch all email subscribers from Resend audience
export async function GET() {
  try {
    const provider = await resolveProvider();
    const subscribers = await provider.listSubscribers();

    return NextResponse.json(subscribers.map(formatSubscriber));
  } catch (error) {
    if (error instanceof EmailProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to fetch subscribers" },
      { status: 500 }
    );
  }
}

// POST /api/subscribers - Add a new email subscriber to Resend audience
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const provider = await resolveProvider();
    const subscriber = await provider.addSubscriber(body.email, {
      firstName: body.firstName,
      lastName: body.lastName,
    });

    return NextResponse.json(formatSubscriber(subscriber), { status: 201 });
  } catch (error: any) {
    // Handle duplicate email error from Resend
    if (
      error.message?.includes("already exists") ||
      error.message?.includes("duplicate")
    ) {
      return NextResponse.json(
        { error: "Email already subscribed" },
        { status: 409 }
      );
    }

    if (error instanceof EmailProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to add subscriber" },
      { status: 500 }
    );
  }
}

// DELETE /api/subscribers - Remove a subscriber from Resend audience
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const id = searchParams.get("id");

    if (!email && !id) {
      return NextResponse.json(
        { error: "Email or ID parameter is required" },
        { status: 400 }
      );
    }

    const provider = await resolveProvider();
    await provider.removeSubscriber({
      id: id ?? undefined,
      email: email ?? undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof EmailProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to remove subscriber" },
      { status: 500 }
    );
  }
}

// PUT /api/subscribers - Update a subscriber (e.g., unsubscribe)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, id, unsubscribed } = body;

    if (!email && !id) {
      return NextResponse.json(
        { error: "Email or ID is required" },
        { status: 400 }
      );
    }

    const provider = await resolveProvider();
    const updated = await provider.updateSubscriber({
      id: id ?? undefined,
      email: email ?? undefined,
      active: !(unsubscribed ?? false),
    });

    return NextResponse.json(formatSubscriber(updated));
  } catch (error) {
    if (error instanceof EmailProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to update subscriber" },
      { status: 500 }
    );
  }
}
