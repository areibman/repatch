"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftIcon, CheckCircleIcon } from "@heroicons/react/16/solid";
import {
  saveTypefullyConfigAction,
  TypefullyActionState,
} from "@/app/integrations/typefully/actions";

type PublicTypefullyConfig = {
  id: string;
  profile_id: string;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
};

export default function TypefullyConfigurePage() {
  const [profileId, setProfileId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [configs, setConfigs] = useState<PublicTypefullyConfig[]>([]);
  const [state, formAction] = useActionState<TypefullyActionState, FormData>(
    saveTypefullyConfigAction,
    { ok: false }
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchConfigs() {
      try {
        const response = await fetch("/api/integrations/typefully", {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data: PublicTypefullyConfig[] = await response.json();
        setConfigs(data);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to load Typefully configs", error);
        }
      }
    }
    fetchConfigs();
    return () => controller.abort();
  }, [state.ok]);

  useEffect(() => {
    if (state.ok) {
      setSuccessMessage("Credentials saved to Supabase.");
      setApiKey("");
      setProfileId("");
      setWorkspaceId("");
    }
  }, [state.ok]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/integrations/typefully" className="flex items-center gap-1">
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Connect Typefully</CardTitle>
          <CardDescription>
            Generate a workspace access token from Typefully and paste it below.
            We store it encrypted inside Supabase so patch notes can be queued
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Profile ID</label>
            <Input
              placeholder="profile_123"
              value={profileId}
              onChange={(event) => setProfileId(event.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              From the Typefully API docs &mdash; identify which Twitter/X
              profile to post from.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Workspace ID (optional)</label>
            <Input
              placeholder="workspace_abc"
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Required only for multi-workspace teams. Leave blank for
              personal accounts.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">API Key</label>
            <Input
              type="password"
              placeholder="tfly_..."
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Keys are encrypted at rest and never exposed in the browser.
            </p>
          </div>
          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          {successMessage && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircleIcon className="h-4 w-4" />
              {successMessage}
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-between items-center gap-2 flex-wrap">
          <div className="text-xs text-muted-foreground">
            Need help? Follow the{" "}
            <a
              href="https://support.typefully.com/en/articles/8718287-typefully-api"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Typefully API guide
            </a>
            .
          </div>
          <form action={formAction} className="inline-flex gap-2 items-center">
            <input type="hidden" name="profileId" value={profileId} />
            <input type="hidden" name="apiKey" value={apiKey} />
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <Button type="submit">Save</Button>
          </form>
        </CardFooter>
      </Card>

      <Card className="max-w-3xl mt-8">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Connected profiles</CardTitle>
            <CardDescription>
              Supabase stores each API credential. Rotate keys from Typefully if
              you suspect a compromise.
            </CardDescription>
          </div>
          <Badge variant="outline">{configs.length} linked</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {configs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No Typefully credentials stored yet.
            </p>
          )}
          {configs.map((config) => (
            <div
              key={config.id}
              className="flex items-center justify-between rounded-md border px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{config.profile_id}</p>
                <p className="text-muted-foreground text-xs">
                  Updated {new Date(config.updated_at).toLocaleString()}
                </p>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                {config.workspace_id ? (
                  <span>Workspace: {config.workspace_id}</span>
                ) : (
                  <span>Personal workspace</span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
