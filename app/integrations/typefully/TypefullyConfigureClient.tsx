"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeftIcon, CheckCircleIcon } from "@heroicons/react/16/solid";
import type { TypefullyConfigRow } from "@/lib/typefully";
import { saveTypefullyConfigAction } from "./actions";

interface Props {
  config: TypefullyConfigRow | null;
}

export default function TypefullyConfigureClient({ config }: Props) {
  const [apiKey, setApiKey] = useState(config?.api_key ?? "");
  const [profileId, setProfileId] = useState(config?.profile_id ?? "");
  const [displayName, setDisplayName] = useState(config?.display_name ?? "");
  const [teamId, setTeamId] = useState(config?.team_id ?? "");
  const [state, formAction] = useActionState(saveTypefullyConfigAction, undefined);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      setShowSuccess(true);
      const timeout = setTimeout(() => setShowSuccess(false), 4000);
      return () => clearTimeout(timeout);
    }
  }, [state?.ok]);

  const isConfigured = useMemo(() => Boolean(config), [config]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/integrations/typefully" className="flex items-center gap-1">
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Connect Typefully</CardTitle>
          <CardDescription>
            Paste a Typefully API key and profile ID to enable threaded patch note
            publishing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">API Key</label>
            <Input
              type="password"
              placeholder="tf_api_..."
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Stored securely in Supabase. Required for all API requests.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Profile ID</label>
            <Input
              placeholder="profile_123"
              value={profileId}
              onChange={(event) => setProfileId(event.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Viewable in the Typefully dashboard under Settings → API access.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Profile Display Name</label>
            <Input
              placeholder="@repatch"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Team ID (optional)</label>
            <Input
              placeholder="team_abc"
              value={teamId ?? ""}
              onChange={(event) => setTeamId(event.target.value)}
            />
          </div>
          {state && !state.ok && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          {showSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircleIcon className="h-4 w-4" />
              Saved Typefully credentials.
            </div>
          )}
          {isConfigured && !showSuccess && (
            <p className="text-xs text-muted-foreground">
              Last saved profile: <strong>{config?.display_name ?? config?.profile_id}</strong>
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href="/integrations">Cancel</Link>
          </Button>
          <form action={formAction} className="inline-flex gap-2 items-center">
            <input type="hidden" name="apiKey" value={apiKey} />
            <input type="hidden" name="profileId" value={profileId} />
            <input type="hidden" name="displayName" value={displayName} />
            <input type="hidden" name="teamId" value={teamId} />
            <Button type="submit">Save</Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
