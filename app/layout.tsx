import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import { SupabaseListener } from "@/components/providers/supabase-listener";
import { SupabaseProvider } from "@/components/providers/supabase-provider";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Suspense>
          <SupabaseProvider>
            <SupabaseListener />
            {children}
          </SupabaseProvider>
        </Suspense>
      </body>
    </html>
  );
}
