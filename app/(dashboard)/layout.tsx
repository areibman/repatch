import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  HomeIcon,
  Cog6ToothIcon,
  UsersIcon,
  UserCircleIcon,
} from "@heroicons/react/16/solid";
import { SidebarHeaderContent } from "@/components/sidebar-header";
import { createServerSupabaseClient } from "@/lib/supabase";
import { UserMenu } from "@/components/user-menu";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, company_name, role")
    .eq("id", session.user.id)
    .maybeSingle();

  const userProfile = {
    id: session.user.id,
    fullName:
      profile?.full_name ||
      (session.user.user_metadata?.full_name as string | undefined) ||
      session.user.email ||
      "User",
    email: profile?.email || session.user.email || "",
    avatarUrl:
      profile?.avatar_url ||
      (session.user.user_metadata?.avatar_url as string | undefined) ||
      null,
    companyName:
      profile?.company_name ||
      (session.user.user_metadata?.company_name as string | undefined) ||
      null,
    role:
      profile?.role ||
      (session.user.user_metadata?.role as string | undefined) ||
      null,
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarHeaderContent />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
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
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/account">
                      <UserCircleIcon />
                      <span>Account</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-4 py-3 text-sm text-muted-foreground">
          Signed in as
          <div className="font-medium text-foreground">{userProfile.fullName}</div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-12 items-center justify-between gap-2 px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm text-muted-foreground">Navigation</span>
            </div>
            <UserMenu profile={userProfile} />
          </div>
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
