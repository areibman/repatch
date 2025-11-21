import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    console.info("[SignOutAPI] Received sign-out request");
    
    // Use global scope to clear both server cookies and revoke refresh tokens
    const { error } = await supabase.auth.signOut({ scope: 'global' });

    if (error) {
      console.error("[SignOutAPI] Supabase sign out error:", error.message);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    console.info("[SignOutAPI] Session cleared successfully");
    // Return success response - cookies are automatically cleared by Supabase
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SignOutAPI] Server sign out failed:", error);
    return NextResponse.json({ error: "Sign out failed", success: false }, { status: 500 });
  }
}


