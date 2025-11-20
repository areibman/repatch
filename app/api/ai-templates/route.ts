import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api/with-auth";
import { mapTemplateRow } from "@/lib/templates";
import type { AiTemplatePayload } from "@/types/ai-template";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET() {
  const start = Date.now();
  console.log("[API] Fetching templates started");

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    // Optimization: Run Auth check and DB query in parallel
    // Using getSession() for local JWT validation
    const authPromise = supabase.auth.getSession();
    const dbPromise = supabase
      .from("ai_templates")
      .select("id, name, content, owner_id, created_at, updated_at") // Explicit columns
      .order("name", { ascending: true });

    const [authResult, dbResult] = await Promise.all([authPromise, dbPromise]);
    
    const { error: authError, data: authData } = authResult;
    let { error: dbError, data: dbData } = dbResult;

    console.log(`[API] Templates: Parallel operations completed in ${Date.now() - start}ms`);

    // 1. Check Auth Failure
    if (authError || !authData.session) {
      console.warn("[API] Templates: No local session, trying remote verification...");
      
      // Fallback: Try remote verification
      const { data: remoteData, error: remoteError } = await supabase.auth.getUser();
      
      if (remoteError || !remoteData.user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    // 2. Retry DB if it failed but Auth succeeded
    if (dbError) {
      console.warn("[API] Templates: Initial DB query failed, retrying...", dbError.message);
      const retryResult = await supabase
        .from("ai_templates")
        .select("id, name, content, owner_id, created_at, updated_at")
        .order("name", { ascending: true });
        
      dbError = retryResult.error;
      dbData = retryResult.data;
    }

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json((dbData || []).map(mapTemplateRow));
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to load templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return withApiAuth(async ({ supabase, auth }) => {
    try {
      const payload = (await request.json()) as AiTemplatePayload;

      if (!payload.name?.trim()) {
        return NextResponse.json(
          { error: "Template name is required" },
          { status: 400 }
        );
      }

      if (!payload.content?.trim()) {
        return NextResponse.json(
          { error: "Template content is required" },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("ai_templates")
        .insert({
          name: payload.name.trim(),
          content: payload.content.trim(),
          owner_id: auth.user.id,
        })
        .select("*")
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message || "Failed to create template" },
          { status: 500 }
        );
      }

      return NextResponse.json(mapTemplateRow(data), { status: 201 });
    } catch (error) {
      console.error("Error creating template:", error);
      return NextResponse.json(
        { error: "Failed to create template" },
        { status: 500 }
      );
    }
  });
}
