import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    
    // Use local scope to properly clear cookies in SSR context
    // This ensures cookies are cleared without requiring an API call to Supabase
    const { error } = await supabase.auth.signOut({ scope: 'local' });

    if (error) {
      console.error("Supabase sign out error:", error.message);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    // Return success response - cookies are automatically cleared by Supabase
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Server sign out failed:", error);
    return NextResponse.json({ error: "Sign out failed", success: false }, { status: 500 });
  }
}


