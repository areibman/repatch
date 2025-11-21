"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, LockIcon, GithubIcon } from "lucide-react";
import type { Provider } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSupabase } from "@/components/providers/supabase-provider";
import { sanitizeRedirect } from "@/lib/auth-redirect";
import { getAppBaseUrl } from "@/lib/url";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirect(searchParams.get("redirectTo"));
  const { supabase, session, isLoading } = useSupabase();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && session) {
      router.replace(redirectTo);
    }
  }, [isLoading, session, redirectTo, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setFormError(error.message);
      setIsSubmitting(false);
      return;
    }

    router.replace(redirectTo);
  };

  const handleOAuthLogin = async (provider: Provider) => {
    setFormError(null);
    setIsSubmitting(true);

    const appBaseUrl = getAppBaseUrl();

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${appBaseUrl}/auth/callback?next=${redirectTo}`,
      },
    });

    if (error) {
      setFormError(error.message);
      if (error.message.includes("Unsupported provider")) {
        setFormError(
          `Sign in with ${provider} is not enabled. Please contact an administrator.`
        );
      }
      setIsSubmitting(false);
    }
  };

  const signupHref = useMemo(
    () =>
      redirectTo && redirectTo !== "/"
        ? `/signup?redirectTo=${encodeURIComponent(redirectTo)}`
        : "/signup",
    [redirectTo]
  );

  return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3 text-primary">
            <LockIcon className="h-6 w-6" />
            <CardTitle className="text-2xl font-semibold">
              Sign in to Repatch
            </CardTitle>
          </div>
          <CardDescription>
            Enter your credentials to access patch notes, templates, and MCP
            tooling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Button
              variant="outline"
              onClick={() => handleOAuthLogin("github")}
              disabled={isSubmitting || (isLoading && session !== null)}
            >
              <GithubIcon className="mr-2 h-4 w-4" />
              GitHub
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOAuthLogin("google")}
              disabled={isSubmitting || (isLoading && session !== null)}
            >
              <svg
                className="mr-2 h-4 w-4"
                aria-hidden="true"
                focusable="false"
                data-prefix="fab"
                data-icon="google"
                role="img"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 488 512"
              >
                <path
                  fill="currentColor"
                  d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                ></path>
              </svg>
              Google
            </Button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="••••••••••••"
              />
            </div>
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || (isLoading && session !== null)}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Need an account?{" "}
            <Link
              href={signupHref}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Create one
            </Link>
            .
          </p>
        </CardContent>
      </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-muted px-4">
      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-4">
            <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading login form...</p>
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  );
}

