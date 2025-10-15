"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeftIcon } from "@heroicons/react/16/solid";
import { useEmailIntegrations } from "@/hooks/use-email-integrations";

export default function CustomerIoConfigurePage() {
  const { providers, loading, error, refresh } = useEmailIntegrations();
  const customerio = useMemo(
    () => providers.find((provider) => provider.id === "customerio"),
    [providers]
  );

  const [siteId, setSiteId] = useState("");
  const [trackApiKey, setTrackApiKey] = useState("");
  const [appApiKey, setAppApiKey] = useState("");
  const [transactionalMessageId, setTransactionalMessageId] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    setFromEmail(customerio?.defaultSender ?? "");
  }, [customerio?.defaultSender]);

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    setStatusError(null);

    try {
      const credentials: Record<string, string> = {};

      if (siteId.trim()) {
        credentials.siteId = siteId.trim();
      }

      if (trackApiKey.trim()) {
        credentials.trackApiKey = trackApiKey.trim();
      }

      if (appApiKey.trim()) {
        credentials.appApiKey = appApiKey.trim();
      }

      if (transactionalMessageId.trim()) {
        credentials.transactionalMessageId = transactionalMessageId.trim();
      }

      if (fromEmail.trim()) {
        credentials.fromEmail = fromEmail.trim();
      }

      const response = await fetch("/api/email-integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "customerio",
          credentials,
          defaultSender: fromEmail.trim(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to save Customer.io settings");
      }

      setStatusMessage("Customer.io settings saved");
      setSiteId("");
      setTrackApiKey("");
      setAppApiKey("");
      setTransactionalMessageId("");
      await refresh();
    } catch (err) {
      setStatusError(
        err instanceof Error
          ? err.message
          : "Failed to save Customer.io settings"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    setActivating(true);
    setStatusMessage(null);
    setStatusError(null);

    try {
      const response = await fetch("/api/email-integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProvider: "customerio" }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to activate Customer.io");
      }

      setStatusMessage("Customer.io set as active provider");
      await refresh();
    } catch (err) {
      setStatusError(
        err instanceof Error
          ? err.message
          : "Failed to activate Customer.io"
      );
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/integrations/customerio" className="flex items-center gap-1">
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Connect Customer.io</CardTitle>
          <CardDescription>
            Provide the site ID, track key, and transactional key used for
            sending newsletters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span>Status:</span>
            {loading ? (
              <span className="text-muted-foreground">Loading…</span>
            ) : error ? (
              <span className="text-destructive">{error}</span>
            ) : customerio ? (
              <Badge variant={customerio.isActive ? "default" : "outline"}>
                {customerio.isActive ? "Active" : "Inactive"}
              </Badge>
            ) : (
              <Badge variant="outline">Not configured</Badge>
            )}
          </div>
          {statusMessage && (
            <div className="text-sm text-emerald-600">{statusMessage}</div>
          )}
          {statusError && (
            <div className="text-sm text-destructive">{statusError}</div>
          )}
          <div>
            <label className="text-sm font-medium">Site ID</label>
            <Input
              placeholder="site_..."
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Track API Key</label>
            <Input
              type="password"
              placeholder="track_..."
              value={trackApiKey}
              onChange={(e) => setTrackApiKey(e.target.value)}
            />
            {customerio?.hasCredentials && (
              <p className="text-xs text-muted-foreground mt-1">
                Enter a new key to rotate credentials. Existing keys remain
                hidden.
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Transactional API Key</label>
            <Input
              type="password"
              placeholder="app_..."
              value={appApiKey}
              onChange={(e) => setAppApiKey(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Transactional Message ID</label>
            <Input
              placeholder="msg_..."
              value={transactionalMessageId}
              onChange={(e) => setTransactionalMessageId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Optional: send through a specific transactional template. Leave
              blank to send fully custom content.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">From Email</label>
            <Input
              type="email"
              placeholder="Patch Notes <patch@yourdomain.com>"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleActivate}
            disabled={customerio?.isActive || activating}
          >
            {activating ? "Setting active…" : "Set Active"}
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/integrations">Cancel</Link>
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
