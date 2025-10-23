import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveIntegration,
  instantiateProvider,
} from "@/lib/email/integrations";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function resolveProvider() {
  const supabase = await createClient();
  const integration = await getActiveIntegration(supabase);
  const provider = instantiateProvider(integration, { supabase });

  return { supabase, provider };
}

// GET /api/subscribers - Fetch all email subscribers
export async function GET() {
  try {
    const { provider } = await resolveProvider();
    const subscribers = await provider.listSubscribers();
    return NextResponse.json(subscribers);
  } catch (error) {
    console.error("Failed to fetch subscribers", error);
    return NextResponse.json(
      { error: "Failed to fetch subscribers" },
      { status: 500 }
    );
  }
}

// POST /api/subscribers - Add a new email subscriber
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!EMAIL_REGEX.test(body.email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const { provider } = await resolveProvider();
    const subscriber = await provider.createSubscriber({
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
    });

    return NextResponse.json(subscriber, { status: 201 });
  } catch (error: any) {
    console.error("Failed to add subscriber", error);
    const message =
      typeof error?.message === "string"
        ? error.message
        : "Failed to add subscriber";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/subscribers - Remove a subscriber
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

    const { provider } = await resolveProvider();
    await provider.removeSubscriber({ id: id ?? undefined, email: email ?? undefined });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove subscriber", error);
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

    const { provider } = await resolveProvider();
    const subscriber = await provider.updateSubscriber({
      email,
      id,
      unsubscribed,
    });

    return NextResponse.json(subscriber);
  } catch (error) {
    console.error("Failed to update subscriber", error);
    return NextResponse.json(
      { error: "Failed to update subscriber" },
      { status: 500 }
    );
  }
}
