import { NextRequest, NextResponse } from "next/server";

import { resolveActiveEmailProvider } from "@/lib/email";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toResponseShape(subscriber: {
  id: string;
  email: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: subscriber.id,
    email: subscriber.email,
    active: subscriber.active,
    created_at: subscriber.createdAt,
    updated_at: subscriber.updatedAt,
  };
}

export async function GET() {
  try {
    const { provider } = await resolveActiveEmailProvider();
    const subscribers = await provider.listSubscribers();
    return NextResponse.json(subscribers.map(toResponseShape));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch subscribers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim();

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const { provider } = await resolveActiveEmailProvider();
    const subscriber = await provider.addSubscriber({
      email,
      firstName: body.firstName,
      lastName: body.lastName,
    });

    return NextResponse.json(toResponseShape(subscriber), { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add subscriber";
    const status = message.includes("already") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
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

    const { provider } = await resolveActiveEmailProvider();
    await provider.removeSubscriber({ email, id });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to remove subscriber";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email ? String(body.email).trim() : undefined;
    const id = body.id ? String(body.id).trim() : undefined;

    if (!email && !id) {
      return NextResponse.json(
        { error: "Email or ID is required" },
        { status: 400 }
      );
    }

    const { provider } = await resolveActiveEmailProvider();
    const subscriber = await provider.updateSubscriber({
      email,
      id,
      unsubscribed: Boolean(body.unsubscribed),
    });

    return NextResponse.json(toResponseShape(subscriber));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update subscriber";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
