"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
import { Label } from "@/components/ui/label";
import { EmailProviderSummary } from "@/lib/email/types";
import { ArrowLeftIcon } from "@heroicons/react/16/solid";

function extractResendSummary(providers: EmailProviderSummary[]) {
  return providers.find((provider) => provider.id === "resend") ?? null;
}

export default function ResendConfigurePage() {
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [audienceId, setAudienceId] = useState("");
  const [setActive, setSetActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<EmailProviderSummary | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch("/api/email/providers");
        if (!response.ok) {
          throw new Error("Failed to load provider state");
        }

        const data = await response.json();
        const resendSummary = extractResendSummary(data.providers || []);
        setSummary(resendSummary);
        setFromEmail(resendSummary?.fromEmail ?? "");
        setFromName(
          typeof resendSummary?.additional?.fromName === "string"
            ? (resendSummary.additional.fromName as string)
            : ""
        );
        setReplyTo(
          typeof resendSummary?.additional?.replyTo === "string"
            ? (resendSummary.additional.replyTo as string)
            : ""
        );
        setAudienceId(
          typeof resendSummary?.additional?.audienceId === "string"
            ? (resendSummary.additional.audienceId as string)
            : ""
        );
        setSetActive(resendSummary?.isActive ?? false);
      } catch (fetchError) {
        console.error(fetchError);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load provider state"
        );
      }
    };

    fetchSummary();
  }, []);

  const hasStoredKey = useMemo(() => summary?.hasApiKey ?? false, [summary]);

  const onSave = async () => {
    setLoading(true);
    setStatus(null);
    setError(null);

    const config: Record<string, string> = {};

    if (apiKey.trim()) {
      config.apiKey = apiKey.trim();
    }
    if (fromEmail.trim()) {
      config.fromEmail = fromEmail.trim();
    }
    if (fromName.trim()) {
      config.fromName = fromName.trim();
    }
    if (replyTo.trim()) {
      config.replyTo = replyTo.trim();
    }
    if (audienceId.trim()) {
      config.audienceId = audienceId.trim();
    }

    try {
      const response = await fetch("/api/email/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "resend",
          config,
          setActive,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to save configuration");
      }

      const data = await response.json();
      const resendSummary = extractResendSummary(
        data.provider ? [data.provider] : []
      );
      if (resendSummary) {
        setSummary(resendSummary);
      }
      if (data.active) {
        setSetActive(data.active.id === "resend");
      }
      setStatus("Resend settings saved successfully");
      setApiKey("");
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save configuration"
      );
    } finally {
      setLoading(false);
    }
  };

  const onActivate = async () => {
    setLoading(true);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch("/api/email/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "resend" }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to activate provider");
      }

      const data = await response.json();
      const resendSummary = extractResendSummary(
        data.provider ? [data.provider] : []
      );
      if (resendSummary) {
        setSummary(resendSummary);
        setSetActive(true);
      }
      setStatus("Resend is now the active provider");
    } catch (activateError) {
      console.error(activateError);
      setError(
        activateError instanceof Error
          ? activateError.message
          : "Failed to activate provider"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/integrations/resend" className="flex items-center gap-1">
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Connect Resend</CardTitle>
          <CardDescription>
            Provide your Resend credentials, default sender, and choose whether
            it should be the active delivery provider.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {status && <p className="text-sm text-muted-foreground">{status}</p>}

          <div className="space-y-2">
            <Label htmlFor="resend-api-key">API Key</Label>
            <Input
              id="resend-api-key"
              type="password"
              placeholder="re_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            {hasStoredKey && !apiKey && (
              <p className="text-xs text-muted-foreground">
                An API key is already stored. Enter a new key to replace it.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="resend-from-email">From Email</Label>
              <Input
                id="resend-from-email"
                type="email"
                placeholder="patch@yourdomain.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resend-from-name">From Name</Label>
              <Input
                id="resend-from-name"
                placeholder="Repatch"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="resend-reply-to">Reply-to Email</Label>
              <Input
                id="resend-reply-to"
                type="email"
                placeholder="support@yourdomain.com"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resend-audience">Audience ID</Label>
              <Input
                id="resend-audience"
                placeholder="fa2a9141-..."
                value={audienceId}
                onChange={(e) => setAudienceId(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="resend-set-active"
              type="checkbox"
              checked={setActive}
              onChange={(event) => setSetActive(event.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="resend-set-active" className="font-normal">
              Set Resend as the active provider after saving
            </Label>
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <div className="text-xs text-muted-foreground">
            Current status: {summary?.isActive ? "Active" : "Inactive"}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onActivate} disabled={loading}>
              Make Active
            </Button>
            <Button onClick={onSave} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
