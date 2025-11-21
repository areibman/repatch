"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GithubIcon, Loader2Icon, UserPlusIcon } from "lucide-react";
import type { Provider } from "@supabase/supabase-js";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSupabase } from "@/components/providers/supabase-provider";
import { sanitizeRedirect } from "@/lib/auth-redirect";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirect(searchParams.get("redirectTo"));
  const { supabase, session, isLoading } = useSupabase();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [signupResultEmail, setSignupResultEmail] = useState<string | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && session) {
      router.replace(redirectTo);
    }
  }, [isLoading, session, redirectTo, router]);

  const handleOAuthSignup = async (provider: Provider) => {
    setFormError(null);
    setSignupResultEmail(null);
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${redirectTo}`,
      },
    });

    if (error) {
      setFormError(
        error.message.includes("Unsupported provider")
          ? `Sign in with ${provider} is not enabled. Please contact an administrator.`
          : error.message
      );
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSignupResultEmail(null);

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    if (password.length < 12) {
      setFormError("Password must be at least 12 characters long.");
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${redirectTo}`,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });

    if (error) {
      setFormError(error.message);
      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      setIsSubmitting(false);
      router.replace(redirectTo);
      return;
    }

    setSignupResultEmail(data.user?.email ?? email);
    setIsSubmitting(false);
    setFullName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };
  const loginHref = useMemo(
    () =>
      redirectTo && redirectTo !== "/"
        ? `/login?redirectTo=${encodeURIComponent(redirectTo)}`
        : "/login",
    [redirectTo]
  );

  const showSuccessState = Boolean(signupResultEmail);

  return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3 text-primary">
            <UserPlusIcon className="h-6 w-6" />
            <CardTitle className="text-2xl font-semibold">
              Create your Repatch account
            </CardTitle>
          </div>
          <CardDescription>
            Start exploring patch notes, templates, and MCP tooling with a
            self-serve account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showSuccessState ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900">
                <p className="text-base font-semibold">Confirm your inbox</p>
                <p className="mt-2">
                  We just sent a verification link to{" "}
                  <span className="font-medium">{signupResultEmail}</span>.
                  Open the email titled{" "}
                  <span className="font-medium">
                    “Repatch — confirm your account”
                  </span>{" "}
                  and follow the button inside to finish setting up your
                  workspace.
                </p>
                <ul className="mt-4 list-disc space-y-1 pl-5 text-emerald-900/90">
                  <li>The link expires in 60 minutes.</li>
                  <li>
                    Didn’t get it? Check your spam folder or try another email.
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <Button className="w-full" onClick={() => router.push(loginHref)}>
                  Go to sign in
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSignupResultEmail(null);
                    setFormError(null);
                  }}
                >
                  Use a different email
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Button
                  variant="outline"
                  onClick={() => handleOAuthSignup("github")}
                  disabled={isSubmitting || isLoading}
                >
                  <GithubIcon className="mr-2 h-4 w-4" />
                  GitHub
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOAuthSignup("google")}
                  disabled={isSubmitting || isLoading}
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
                    Or sign up with email
                  </span>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Ada Lovelace"
                  />
                </div>
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
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    placeholder="••••••••••••"
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum 12 characters. Use a unique passphrase for best
                    security.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
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
                  disabled={isSubmitting || isLoading}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                      Creating account…
                    </span>
                  ) : (
                    "Create account"
                  )}
                </Button>
              </form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href={loginHref}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
                .
              </p>
            </>
          )}
        </CardContent>
      </Card>
  );
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-muted px-4">
      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-4">
            <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading signup form...</p>
          </div>
        }
      >
        <SignupContent />
      </Suspense>
    </div>
  );
}


