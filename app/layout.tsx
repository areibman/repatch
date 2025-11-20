import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { SupabaseProvider } from "@/components/providers/supabase-provider";
import { ProtectedShell } from "@/components/auth/protected-shell";
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
            <ProtectedShell>{children}</ProtectedShell>
          </SupabaseProvider>
        </Suspense>
      </body>
    </html>
  );
}
