'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { UserCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

interface UserMenuProps {
  user: {
    email: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.refresh();
    } catch (error) {
      console.error('Error signing out:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.full_name || user.email}
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <UserCircleIcon className="h-8 w-8" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Account</SheetTitle>
          <SheetDescription>
            Manage your account settings
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {user.full_name || 'User'}
            </p>
            <p className="text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
          
          <div className="border-t pt-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleSignOut}
              disabled={isLoggingOut}
            >
              <ArrowRightOnRectangleIcon className="mr-2 h-4 w-4" />
              {isLoggingOut ? 'Signing out...' : 'Sign Out'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
