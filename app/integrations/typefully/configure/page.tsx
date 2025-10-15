"use client";

import Link from "next/link";
import { useState } from "react";
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

export default function TypefullyConfigurePage() {
  const [apiKey, setApiKey] = useState("");
  const [profileId, setProfileId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/typefully/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, profileId, teamId: teamId || null }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed to save configuration");
      }
      alert("Saved Typefully configuration");
    } catch (e: any) {
      alert(e.message || "Failed to save configuration");
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
            Provide your Typefully API key and profile details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">API Key</label>
            <Input
              type="password"
              placeholder="tf_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Profile ID</label>
            <Input
              placeholder="profile_xxx"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Team ID (optional)</label>
            <Input
              placeholder="team_xxx"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href="/integrations">Cancel</Link>
          </Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
