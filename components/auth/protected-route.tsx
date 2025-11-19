/**
 * Protected Route Component
 * 
 * Server component that requires authentication.
 * Redirects to login if user is not authenticated.
 */

import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth/server';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export async function ProtectedRoute({ 
  children, 
  redirectTo = '/auth/login' 
}: ProtectedRouteProps) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect(redirectTo);
  }

  return <>{children}</>;
}
