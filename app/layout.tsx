import type { Metadata } from "next";
import type { Session } from "@supabase/supabase-js";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { SupabaseProvider } from "@/components/providers/supabase-provider";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { createServerSupabaseClient } from "@/lib/supabase";
import { logAuthEvent } from "@/lib/logging";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Repatch",
  description: "AI-generated patch notes newsletter",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialSession: Session | null = null;

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      logAuthEvent("server_session_load_failed", {
        error: error.message,
      });
    }

    initialSession = session ?? null;
    logAuthEvent("server_session_resolved", {
      hasSession: Boolean(session),
      userId: session?.user.id ?? null,
    });
  } catch (error) {
    console.error("Failed to hydrate Supabase session on server", error);
    logAuthEvent("server_session_exception", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Suspense>
          <SupabaseProvider initialSession={initialSession}>
            <ProtectedShell>{children}</ProtectedShell>
          </SupabaseProvider>
        </Suspense>
      </body>
    </html>
  );
}
