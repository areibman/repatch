import { NextRequest, NextResponse } from "next/server";
import { getEmailProvider } from "@/lib/email";
import { EmailSubscriber } from "@/lib/email/types";

function mapToResponse(subscriber: EmailSubscriber) {
  return {
    id: subscriber.id,
    email: subscriber.email,
    active: subscriber.active,
    created_at: subscriber.createdAt,
    updated_at: subscriber.updatedAt,
  };
}

function validateEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function GET() {
  try {
    const provider = await getEmailProvider();
    const subscribers = await provider.listSubscribers();

    return NextResponse.json(subscribers.map(mapToResponse));
  } catch (error) {
    console.error("Failed to fetch subscribers", error);
    return NextResponse.json(
      { error: "Failed to fetch subscribers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const provider = await getEmailProvider();
    const body = await request.json();

    if (!validateEmail(body.email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const subscriber = await provider.addSubscriber({
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
    });

    return NextResponse.json(mapToResponse(subscriber), { status: 201 });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /already/i.test(message) ? 409 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const provider = await getEmailProvider();
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const id = searchParams.get("id");

    if (!email && !id) {
      return NextResponse.json(
        { error: "Email or ID parameter is required" },
        { status: 400 }
      );
    }

    await provider.removeSubscriber({ email: email ?? undefined, id: id ?? undefined });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove subscriber", error);
    return NextResponse.json(
      { error: "Failed to remove subscriber" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const provider = await getEmailProvider();
    const body = await request.json();

    if (!body.email && !body.id) {
      return NextResponse.json(
        { error: "Email or ID is required" },
        { status: 400 }
      );
    }

    const subscriber = await provider.updateSubscriber({
      email: body.email,
      id: body.id,
      unsubscribed: body.unsubscribed,
    });

    return NextResponse.json(mapToResponse(subscriber));
  } catch (error) {
    console.error("Failed to update subscriber", error);
    return NextResponse.json(
      { error: "Failed to update subscriber" },
      { status: 500 }
    );
  }
}
