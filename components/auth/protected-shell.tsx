"use client";

import { useEffect, useMemo, useState, type ReactNode, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, LogOutIcon } from "lucide-react";
import { HomeIcon, Cog6ToothIcon, UsersIcon } from "@heroicons/react/16/solid";

import { Button } from "@/components/ui/button";
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
import { SidebarHeaderContent } from "@/components/sidebar-header";
import { useSupabase } from "@/components/providers/supabase-provider";

const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback"];

export function ProtectedShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? "";
  const { supabase, session, isLoading } = useSupabase();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isProtectedRoute = useMemo(
    () => !PUBLIC_PATHS.some((path) => pathname.startsWith(path)),
    [pathname]
  );

  useEffect(() => {
    if (!isProtectedRoute || isLoading || session) {
      return;
    }

    const targetPath = searchParamsString
      ? `${pathname}?${searchParamsString}`
      : pathname;

    const params = new URLSearchParams();
    params.set("redirectTo", targetPath);

    router.replace(`/login?${params.toString()}`);
  }, [
    isProtectedRoute,
    isLoading,
    session,
    pathname,
    router,
    searchParamsString,
  ]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setIsSigningOut(false);
    router.replace("/login");
  };

  if (!isProtectedRoute) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  if (isLoading || (!session && isProtectedRoute)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Checking your session…</p>
      </div>
    );
  }

  return (
    <Suspense>
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
            <LogOutIcon className="h-4 w-4" />
            <span>{isSigningOut ? "Signing out…" : "Sign out"}</span>
          </Button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-12 items-center gap-2 px-4">
            <SidebarTrigger />
            <div className="ml-auto text-sm text-muted-foreground">
              {session?.user?.email}
            </div>
          </div>
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
    </Suspense>
  );
}

