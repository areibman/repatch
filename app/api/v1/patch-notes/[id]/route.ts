import { NextRequest, NextResponse } from 'next/server';
import { getPatchNote, updatePatchNote, deletePatchNote } from '@/lib/api/patch-notes';

type Params = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const result = await getPatchNote(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json(result.data);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const result = await updatePatchNote(id, body);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result.data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const result = await deletePatchNote(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result.data);
}
