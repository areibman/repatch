import { NextRequest, NextResponse } from "next/server";
import { getEmailProvider, summarizeIntegration } from "@/lib/email/integrations";
import { createClient } from "@/lib/supabase/server";

function formatError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === "string") {
    return error;
  }

  return fallback;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const provider = await getEmailProvider(supabase);
    const subscribers = await provider.listSubscribers();

    return NextResponse.json({
      provider: provider.name,
      integration: summarizeIntegration(provider.config),
      subscribers,
    });
  } catch (error) {
    console.error("Failed to fetch subscribers", error);
    return NextResponse.json(
      { error: formatError(error, "Failed to fetch subscribers") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const provider = await getEmailProvider(supabase);
    const subscriber = await provider.addSubscriber({
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
    });

    return NextResponse.json(
      {
        subscriber,
        provider: provider.name,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const message = formatError(error, "Failed to add subscriber");
    const normalizedMessage =
      message.toLowerCase().includes("exist") ||
      message.toLowerCase().includes("duplicate")
        ? "Email already subscribed"
        : message;

    return NextResponse.json(
      { error: normalizedMessage },
      { status: normalizedMessage === "Email already subscribed" ? 409 : 500 }
    );
  }
}

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

    const supabase = await createClient();
    const provider = await getEmailProvider(supabase);
    await provider.removeSubscriber({
      email: email ?? undefined,
      id: id ?? undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: formatError(error, "Failed to remove subscriber") },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, id, unsubscribed } = body ?? {};

    if (!email && !id) {
      return NextResponse.json(
        { error: "Email or ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const provider = await getEmailProvider(supabase);
    const subscriber = await provider.updateSubscriber({
      email: email ?? undefined,
      id: id ?? undefined,
      unsubscribed,
    });

    return NextResponse.json({ subscriber });
  } catch (error) {
    return NextResponse.json(
      { error: formatError(error, "Failed to update subscriber") },
      { status: 500 }
    );
  }
}
