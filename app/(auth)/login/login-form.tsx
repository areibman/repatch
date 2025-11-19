"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2Icon } from "lucide-react";
import { signIn, signUp, type AuthActionState } from "@/app/(auth)/actions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2Icon className="h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        label
      )}
    </Button>
  );
}

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction] = useFormState(signIn, initialState);
  const [signUpState, signUpAction] = useFormState(signUp, initialState);

  const state = mode === "signin" ? signInState : signUpState;
  const action = mode === "signin" ? signInAction : signUpAction;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>{mode === "signin" ? "Welcome back" : "Create your account"}</CardTitle>
        <CardDescription>
          {mode === "signin"
            ? "Sign in with your Supabase account to continue."
            : "Set up credentials to access the dashboard."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Jane Doe"
                autoComplete="name"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </div>

          {state?.error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          {state?.success && (
            <p className="rounded-md border border-emerald-500/50 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/40">
              {state.success}
            </p>
          )}

          <SubmitButton label={mode === "signin" ? "Sign in" : "Create account"} />
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button
          type="button"
          variant="link"
          className="text-sm"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </Button>
        {mode === "signup" && (
          <p className="text-xs text-muted-foreground">
            We&apos;ll send a confirmation email via Supabase Auth before you can sign in.
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
