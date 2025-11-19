"use client";

import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

interface UserMenuProps {
  profile: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string | null;
    companyName?: string | null;
    role?: string | null;
  };
}

export function UserMenu({ profile }: UserMenuProps) {
  const initials = profile.fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-4">
      <div className="text-right text-sm leading-tight">
        <div className="font-medium text-foreground">{profile.fullName}</div>
        <div className="text-xs text-muted-foreground">{profile.email}</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary uppercase">
          {initials || "U"}
        </div>
        <form action={signOut}>
          <Button type="submit" size="sm" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
