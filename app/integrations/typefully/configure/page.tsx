"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import { ArrowLeftIcon } from "@heroicons/react/16/solid";

interface TypefullyConfigResponse {
  config: {
    api_key: string;
    profile_id: string;
    workspace_id: string | null;
  } | null;
}

export default function TypefullyConfigurePage() {
  const [apiKey, setApiKey] = useState("");
  const [profileId, setProfileId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/typefully/config");
        if (!response.ok) {
          throw new Error("Failed to load configuration");
        }
        const data = (await response.json()) as TypefullyConfigResponse;
        if (data.config) {
          setApiKey(data.config.api_key);
          setProfileId(data.config.profile_id);
          setWorkspaceId(data.config.workspace_id ?? "");
        }
      } catch (error) {
        console.error("Failed to load Typefully config", error);
        setStatus({ type: "error", message: "Unable to load saved credentials" });
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const onSave = async () => {
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch("/api/typefully/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          profileId,
          workspaceId: workspaceId || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save configuration");
      }

      setStatus({ type: "success", message: "Typefully credentials saved" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save configuration";
      setStatus({ type: "error", message });
    } finally {
      setSaving(false);
    }
  };

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
            Provide the API key and profile ID from your Typefully dashboard. These credentials let Repatch queue Twitter threads on your behalf.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status && (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                status.type === "success"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-red-500 bg-red-50 text-red-700"
              }`}
            >
              {status.message}
            </div>
          )}
          <div>
            <label className="text-sm font-medium">API Key</label>
            <Input
              type="password"
              placeholder="tf_api_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Generate a key under Settings → API in Typefully.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Profile ID</label>
            <Input
              placeholder="profile_123"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Paste the ID of the social profile you want to post with.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Workspace ID (optional)</label>
            <Input
              placeholder="workspace_123"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Provide this if your Typefully account belongs to a team workspace.
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href="/integrations">Cancel</Link>
          </Button>
          <Button onClick={onSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
