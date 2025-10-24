import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEmailProviderAdapter } from "@/lib/email/providers";
import { getActiveEmailIntegration } from "@/lib/email/integrations";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function resolveProvider() {
  const supabase = await createClient();
  const integration = await getActiveEmailIntegration(supabase);

  if (!integration) {
    throw new Error("No email provider is configured");
  }

  const adapter = createEmailProviderAdapter(integration);
  return { adapter };
}

// GET /api/subscribers - Fetch all email subscribers from the active provider
export async function GET() {
  try {
    const { adapter } = await resolveProvider();
    const subscribers = await adapter.listSubscribers();
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
    const email = String(body.email ?? "").trim();
    const firstName = body.firstName ? String(body.firstName) : "";
    const lastName = body.lastName ? String(body.lastName) : "";

    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const { adapter } = await resolveProvider();
    const subscriber = await adapter.createSubscriber({
      email,
      firstName,
      lastName,
    });

    return NextResponse.json(subscriber, { status: 201 });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("exists")) {
      return NextResponse.json(
        { error: "Email already subscribed" },
        { status: 409 }
      );
    }

    console.error("Failed to add subscriber", error);
    return NextResponse.json(
      { error: "Failed to add subscriber" },
      { status: 500 }
    );
  }
}

// DELETE /api/subscribers - Remove a subscriber
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email") ?? undefined;
    const id = searchParams.get("id") ?? undefined;

    if (!email && !id) {
      return NextResponse.json(
        { error: "Email or ID parameter is required" },
        { status: 400 }
      );
    }

    const { adapter } = await resolveProvider();
    await adapter.deleteSubscriber({ id: id ?? undefined, email });

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

    const { adapter } = await resolveProvider();
    const subscriber = await adapter.updateSubscriber({
      email: email ?? undefined,
      id: id ?? undefined,
      active: !(unsubscribed ?? false),
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
