import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const AUDIENCE_ID = 'fa2a9141-3fa1-4d41-a873-5883074e6516';

function getResendClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function GET() {
  try {
    const resend = getResendClient();
    const contacts = await resend.contacts.list({ audienceId: AUDIENCE_ID });

    if (!contacts.data) {
      return NextResponse.json(
        { error: 'Failed to fetch contacts from Resend' },
        { status: 500 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      { error: 'Failed to fetch subscribers' },
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
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const resend = getResendClient();
    const contact = await resend.contacts.create({
      email: body.email,
      firstName: body.firstName || '',
      lastName: body.lastName || '',
      unsubscribed: false,
      audienceId: AUDIENCE_ID,
    });

    if (!contact.data) {
      return NextResponse.json(
        { error: 'Failed to add contact to Resend audience' },
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '';
    if (
      errorMessage?.includes('already exists') ||
      errorMessage?.includes('duplicate')
    ) {
      return NextResponse.json(
        { error: 'Email already subscribed' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add subscriber' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, id, unsubscribed } = body;

    if (!email && !id) {
      return NextResponse.json(
        { error: 'Email or ID is required' },
        { status: 400 }
      );
    }

    const resend = getResendClient();
    const result = await resend.contacts.update({
      ...(id ? { id } : { email }),
      audienceId: AUDIENCE_ID,
      unsubscribed: unsubscribed ?? false,
    });

    if (!result.data) {
      return NextResponse.json(
        { error: 'Failed to update contact in Resend audience' },
        { status: 500 }
      );
    }

    const subscriber = {
      id: result.data.id,
      email: email || id || '',
      active: !(unsubscribed ?? false),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(subscriber);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update subscriber' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const id = searchParams.get('id');

    if (!email && !id) {
      return NextResponse.json(
        { error: 'Email or ID parameter is required' },
        { status: 400 }
      );
    }

    const resend = getResendClient();
    const result = await resend.contacts.remove({
      ...(id ? { id } : { email: email || '' }),
      audienceId: AUDIENCE_ID,
    });

    if (!result.data) {
      return NextResponse.json(
        { error: 'Failed to remove contact from Resend audience' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to remove subscriber' },
      { status: 500 }
    );
  }
}
