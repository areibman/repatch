/**
 * Auth Provider Component
 * 
 * Server component that checks authentication status and displays
 * either the user menu or sign in button
 */

import { getUserProfile } from '@/lib/auth/server';
import { UserMenu } from './user-menu';
import { AuthButton } from './auth-button';

export async function AuthProvider() {
  const profile = await getUserProfile();

  if (!profile) {
    return <AuthButton />;
  }

  return (
    <UserMenu
      user={{
        email: profile.email || '',
        full_name: profile.full_name || undefined,
        avatar_url: profile.avatar_url || undefined,
      }}
    />
  );
}
