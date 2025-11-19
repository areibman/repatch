"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2Icon } from "lucide-react";
import { updateProfile, type ProfileFormState } from "./actions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: ProfileFormState = {};

interface ProfileFormProps {
  profile: {
    fullName: string;
    email: string;
    companyName: string;
    role: string;
  };
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2Icon className="h-4 w-4 animate-spin" />
          Saving...
        </>
      ) : (
        "Save changes"
      )}
    </Button>
  );
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [state, formAction] = useFormState(updateProfile, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account profile</CardTitle>
        <CardDescription>Update the information that appears across the app.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={profile.fullName}
              placeholder="Jane Doe"
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile.email} disabled className="bg-muted/70" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_name">Company</Label>
            <Input
              id="company_name"
              name="company_name"
              defaultValue={profile.companyName}
              placeholder="ACME Inc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              name="role"
              defaultValue={profile.role}
              placeholder="Head of Engineering"
            />
          </div>

          {state?.error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          {state?.success && (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {state.success}
            </p>
          )}

          <div className="flex justify-end">
            <SaveButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
