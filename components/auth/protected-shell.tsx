"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, LogOutIcon } from "lucide-react";
import { HomeIcon, Cog6ToothIcon, UsersIcon } from "@heroicons/react/16/solid";

import { Button } from "@/components/ui/button";
import { SidebarHeaderContent } from "@/components/sidebar-header";
import { useSupabase } from "@/components/providers/supabase-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { AuthContext } from "@/lib/supabase";

interface ProtectedShellProps {
  children: ReactNode;
  auth: AuthContext;
}

export function ProtectedShell({ children, auth }: ProtectedShellProps) {
  const router = useRouter();
  const { supabase } = useSupabase();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const displayName =
    auth.profile?.full_name ||
    (auth.user.user_metadata as Record<string, string | undefined>)?.full_name ||
    auth.user.email ||
    "Signed in";

  const handleSignOut = async () => {
    if (isSigningOut) {
      console.warn("[SignOut] Attempted while already in progress");
      return;
    }

    setIsSigningOut(true);
    console.log("[SignOut] Starting sign-out flow");

    try {
      console.log("[SignOut] Calling /api/auth/signout");
      // Call server-side sign out endpoint first
      const response = await fetch("/api/auth/signout", {
        method: "POST",
        cache: "no-store",
      });
      
      if (!response.ok) {
        console.error(
          "[SignOut] Server sign out failed",
          response.status,
          response.statusText
        );
      } else {
        const result = await response.json();
        if (!result.success) {
          console.error("[SignOut] Server sign out returned error", result.error);
        } else {
          console.log("[SignOut] Server session cleared");
        }
      }
    } catch (error) {
      console.error("[SignOut] Server sign out request failed:", error);
    }

    try {
      // Ensure browser storage and tokens are cleared
      console.log("[SignOut] Calling supabase.auth.signOut({ scope: 'global' })");
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) {
        console.error("[SignOut] Client sign out failed:", error);
      } else {
        console.log("[SignOut] Client session cleared");
      }
    } catch (error) {
      console.error("[SignOut] Client sign out exception:", error);
    } finally {
      setIsSigningOut(false);
      console.log("[SignOut] Redirecting to /login");
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarHeaderContent />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/">
                      <HomeIcon />
                      <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/subscribers">
                      <UsersIcon />
                      <span>Subscribers</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/settings/templates">
                      <Cog6ToothIcon />
                      <span>Templates</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut && <Loader2Icon className="h-4 w-4 animate-spin" />}
            {!isSigningOut && <LogOutIcon className="h-4 w-4" />}
            <span>{isSigningOut ? "Signing out…" : "Sign out"}</span>
          </Button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-12 items-center gap-2 px-4">
            <SidebarTrigger />
            <div className="ml-auto text-right text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{displayName}</p>
              {auth.user.email && <p>{auth.user.email}</p>}
            </div>
          </div>
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}


