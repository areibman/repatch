import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const isMock = process.env.REPATCH_TEST_MODE === "mock";
const createResendClient = () => new Resend(process.env.RESEND_API_KEY);

// GET /api/subscribers - Fetch all email subscribers from Resend audience
export async function GET() {
  try {
    if (isMock) {
      const { listSubscribers } = await import("@/lib/testing/mockStore");
      const subscribers = listSubscribers().map((subscriber) => ({
        id: subscriber.id,
        email: subscriber.email,
        active: !subscriber.unsubscribed,
        created_at: subscriber.created_at,
        updated_at: subscriber.updated_at,
      }));
      return NextResponse.json(subscribers);
    }

    const audienceId = "fa2a9141-3fa1-4d41-a873-5883074e6516";

    const resend = createResendClient();
    const contacts = await resend.contacts.list({ audienceId });

    if (!contacts.data) {
      return NextResponse.json(
        { error: "Failed to fetch contacts from Resend" },
        { status: 500 }
      );
    }

    const subscribers = contacts.data.data.map((contact: any) => ({
      id: contact.id,
      email: contact.email,
      active: !contact.unsubscribed,
      created_at: contact.created_at,
      updated_at: contact.updated_at,
    }));

    return NextResponse.json(subscribers);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch subscribers" },
      { status: 500 }
    );
  }
}

// POST /api/subscribers - Add a new email subscriber to Resend audience
export async function POST(request: NextRequest) {
  try {
    const audienceId = "fa2a9141-3fa1-4d41-a873-5883074e6516";

    const body = await request.json();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (isMock) {
      try {
        const { addSubscriber } = await import("@/lib/testing/mockStore");
        const subscriber = addSubscriber(body.email);
        return NextResponse.json(
          {
            id: subscriber.id,
            email: subscriber.email,
            active: true,
            created_at: subscriber.created_at,
            updated_at: subscriber.updated_at,
            mode: "mock",
          },
          { status: 201 }
        );
      } catch (error: any) {
        if (error instanceof Error && error.message.includes("already")) {
          return NextResponse.json(
            { error: "Email already subscribed" },
            { status: 409 }
          );
        }
        throw error;
      }
    }

    const resend = createResendClient();
    const contact = await resend.contacts.create({
      email: body.email,
      firstName: body.firstName || "",
      lastName: body.lastName || "",
      unsubscribed: false,
      audienceId: audienceId,
    });

    if (!contact.data) {
      return NextResponse.json(
        { error: "Failed to add contact to Resend audience" },
        { status: 500 }
      );
    }

    const subscriber = {
      id: contact.data.id,
      email: body.email,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(subscriber, { status: 201 });
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

    return NextResponse.json(
      { error: "Failed to add subscriber" },
      { status: 500 }
    );
  }
}

// DELETE /api/subscribers - Remove a subscriber from Resend audience
export async function DELETE(request: NextRequest) {
  try {
    // Use hardcoded audience ID from the docs
    const audienceId = "fa2a9141-3fa1-4d41-a873-5883074e6516";

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const id = searchParams.get("id");

    if (!email && !id) {
      return NextResponse.json(
        { error: "Email or ID parameter is required" },
        { status: 400 }
      );
    }

    // Remove contact from Resend audience
    if (isMock) {
      const { removeSubscriber } = await import("@/lib/testing/mockStore");
      const removed = removeSubscriber({ id: id ?? undefined, email: email ?? undefined });
      if (!removed) {
        return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    const resend = createResendClient();
    const result = await resend.contacts.remove({
      ...(id ? { id } : { email: email! }),
      audienceId: audienceId,
    });

    if (!result.data) {
      return NextResponse.json(
        { error: "Failed to remove contact from Resend audience" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to remove subscriber" },
      { status: 500 }
    );
  }
}

// PUT /api/subscribers - Update a subscriber (e.g., unsubscribe)
export async function PUT(request: NextRequest) {
  try {
    // Use hardcoded audience ID from the docs
    const audienceId = "fa2a9141-3fa1-4d41-a873-5883074e6516";

    const body = await request.json();
    const { email, id, unsubscribed } = body;

    if (!email && !id) {
      return NextResponse.json(
        { error: "Email or ID is required" },
        { status: 400 }
      );
    }

    // Update contact in Resend audience
    if (isMock) {
      const { updateSubscriber } = await import("@/lib/testing/mockStore");
      const updated = updateSubscriber({ id: id ?? undefined, email: email ?? undefined }, { unsubscribed });
      if (!updated) {
        return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
      }
      return NextResponse.json({
        id: updated.id,
        email: updated.email,
        active: !updated.unsubscribed,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        mode: "mock",
      });
    }

    const resend = createResendClient();
    const result = await resend.contacts.update({
      ...(id ? { id } : { email }),
      audienceId: audienceId,
      unsubscribed: unsubscribed ?? false,
    });

    if (!result.data) {
      return NextResponse.json(
        { error: "Failed to update contact in Resend audience" },
        { status: 500 }
      );
    }

    const subscriber = {
      id: result.data.id,
      email: email || id || "",
      active: !(unsubscribed ?? false),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(subscriber);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update subscriber" },
      { status: 500 }
    );
  }
}
