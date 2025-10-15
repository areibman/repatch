"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
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
import { saveTypefullyConfigAction } from "@/app/integrations/typefully/actions";

interface ConfigResponse {
  id: string;
  label: string | null;
  workspaceId: string | null;
  profileId: string | null;
  teamId: string | null;
  updatedAt: string;
  hasApiKey: boolean;
}

export default function TypefullyConfigurePage() {
  const [state, formAction] = useActionState(saveTypefullyConfigAction, {
    ok: false,
  });
  const [apiKey, setApiKey] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const response = await fetch("/api/typefully/config");
        if (!response.ok) {
          throw new Error("Failed to load config");
        }
        const data = (await response.json()) as ConfigResponse | null;
        if (data && isMounted) {
          setWorkspaceId(data.workspaceId ?? "");
          setProfileId(data.profileId ?? "");
          setTeamId(data.teamId ?? "");
          setLabel(data.label ?? "");
          setLastUpdated(data.updatedAt);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (state.ok) {
      setApiKey("");
      if (typeof window !== "undefined") {
        setLastUpdated(new Date().toISOString());
      }
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
        {lastUpdated && (
          <Badge variant="secondary">Updated {new Date(lastUpdated).toLocaleString()}</Badge>
        )}
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Connect Typefully</CardTitle>
          <CardDescription>
            Provide a Typefully API key along with the workspace and profile IDs
            you want to post from.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">API Key</label>
            <Input
              type="password"
              placeholder="tf_sk_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              The key is stored securely in Supabase and never exposed client-side.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Workspace ID</label>
              <Input
                placeholder="wrk_..."
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Profile ID</label>
              <Input
                placeholder="pro_..."
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Team ID (optional)</label>
            <Input
              placeholder="team_..."
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Label (optional)</label>
            <Input
              placeholder="Main marketing account"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          {loading && (
            <p className="text-sm text-muted-foreground">Loading existing configuration…</p>
          )}
          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          {state.ok && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircleIcon className="h-4 w-4" />
              Saved! Future requests will use the new credentials.
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href="/integrations">Cancel</Link>
          </Button>
          <form action={formAction} className="inline-flex gap-2 items-center">
            <input type="hidden" name="apiKey" value={apiKey} />
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="profileId" value={profileId} />
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="label" value={label} />
            <Button type="submit" disabled={!apiKey && !workspaceId && !profileId}>
              Save
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
