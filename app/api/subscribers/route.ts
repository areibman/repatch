import { NextRequest, NextResponse } from "next/server";
import {
  createEmailProvider,
  EmailProviderConfigurationError,
  getActiveEmailIntegration,
} from "@/lib/email";

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function resolveProvider() {
  const integration = await getActiveEmailIntegration();

  if (!integration) {
    throw new EmailProviderConfigurationError(
      "No email provider is configured. Configure an email integration first."
    );
  }

  return createEmailProvider(integration);
}

export async function GET() {
  try {
    const provider = await resolveProvider();
    const subscribers = await provider.listSubscribers();

    const payload = subscribers.map((subscriber) => ({
      id: subscriber.id,
      email: subscriber.email,
      active: subscriber.active,
      created_at: subscriber.createdAt ?? null,
      updated_at: subscriber.updatedAt ?? null,
    }));

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof EmailProviderConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Failed to fetch subscribers", error);
    return NextResponse.json(
      { error: "Failed to fetch subscribers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim();

    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const provider = await resolveProvider();
    const subscriber = await provider.addSubscriber(email, {
      firstName: body.firstName ?? undefined,
      lastName: body.lastName ?? undefined,
    });

    return NextResponse.json(
      {
        id: subscriber.id,
        email: subscriber.email,
        active: subscriber.active,
        created_at: subscriber.createdAt ?? new Date().toISOString(),
        updated_at: subscriber.updatedAt ?? new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof EmailProviderConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (typeof error?.message === "string" && error.message.includes("exists")) {
      return NextResponse.json({ error: "Email already subscribed" }, { status: 409 });
    }

    console.error("Failed to add subscriber", error);
    return NextResponse.json(
      { error: "Failed to add subscriber" },
      { status: 500 }
    );
  }
}

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

    const provider = await resolveProvider();
    await provider.removeSubscriber({ email: email ?? undefined, id: id ?? undefined });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof EmailProviderConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Failed to remove subscriber", error);
    return NextResponse.json(
      { error: "Failed to remove subscriber" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email ? String(body.email) : undefined;
    const id = body.id ? String(body.id) : undefined;

    if (!email && !id) {
      return NextResponse.json(
        { error: "Email or ID is required" },
        { status: 400 }
      );
    }

    const provider = await resolveProvider();
    const updated = await provider.updateSubscriber(
      { email, id },
      { active: body.unsubscribed === undefined ? undefined : !body.unsubscribed }
    );

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      active: updated.active,
      created_at: updated.createdAt ?? new Date().toISOString(),
      updated_at: updated.updatedAt ?? new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof EmailProviderConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Failed to update subscriber", error);
    return NextResponse.json(
      { error: "Failed to update subscriber" },
      { status: 500 }
    );
  }
}
