import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { SupabaseListener } from "@/components/providers/supabase-listener";
import { SupabaseProvider } from "@/components/providers/supabase-provider";
import { createServerSupabaseClient } from "@/lib/supabase";
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
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);

  // Use getUser() for secure server-side validation instead of getSession()
  const { data: userData, error: userError } = await supabase.auth.getUser();

  // Only fetch session if user is authenticated
  let session = null;
  if (!userError && userData.user) {
    const { data: sessionData } = await supabase.auth.getSession();
    session = sessionData.session;
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Suspense>
          <SupabaseProvider initialSession={session}>
            <SupabaseListener serverAccessToken={session?.access_token} />
            {children}
          </SupabaseProvider>
        </Suspense>
      </body>
    </html>
  );
}
