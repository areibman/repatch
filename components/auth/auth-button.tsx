import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { UserCircleIcon } from '@heroicons/react/24/outline';

export function AuthButton() {
  return (
    <Button asChild variant="ghost">
      <Link href="/auth/login">
        <UserCircleIcon className="mr-2 h-5 w-5" />
        Sign In
      </Link>
    </Button>
  );
}
