import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { mapTemplateRow } from '@/lib/templates';
import type { AiTemplatePayload } from '@/types/ai-template';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    const { data, error } = await supabase
      .from('ai_templates')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json((data || []).map(mapTemplateRow));
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as AiTemplatePayload;

    if (!payload.name?.trim()) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    if (!payload.content?.trim()) {
      return NextResponse.json(
        { error: 'Template content is required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    const { data, error } = await supabase
      .from('ai_templates')
      .insert({
        name: payload.name.trim(),
        content: payload.content.trim(),
      })
      .select('*')
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || 'Failed to create template' },
        { status: 500 }
      );
    }

    return NextResponse.json(mapTemplateRow(data), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
