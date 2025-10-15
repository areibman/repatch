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

function extractCustomerioSummary(providers: EmailProviderSummary[]) {
  return providers.find((provider) => provider.id === "customerio") ?? null;
}

export default function CustomerioConfigurePage() {
  const [siteId, setSiteId] = useState("");
  const [appApiKey, setAppApiKey] = useState("");
  const [transactionalApiKey, setTransactionalApiKey] = useState("");
  const [transactionalMessageId, setTransactionalMessageId] = useState("");
  const [region, setRegion] = useState("us");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
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
        const providerSummary = extractCustomerioSummary(data.providers || []);
        setSummary(providerSummary);
        setFromEmail(providerSummary?.fromEmail ?? "");
        setFromName(
          typeof providerSummary?.additional?.fromName === "string"
            ? (providerSummary.additional.fromName as string)
            : ""
        );
        setReplyTo(
          typeof providerSummary?.additional?.replyTo === "string"
            ? (providerSummary.additional.replyTo as string)
            : ""
        );
        setRegion(
          typeof providerSummary?.additional?.region === "string"
            ? (providerSummary.additional.region as string)
            : "us"
        );
        setTransactionalMessageId(
          typeof providerSummary?.additional?.transactionalMessageId === "string"
            ? (providerSummary.additional.transactionalMessageId as string)
            : ""
        );
        setSetActive(providerSummary?.isActive ?? false);
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

  const hasStoredKeys = useMemo(() => summary?.hasApiKey ?? false, [summary]);

  const saveConfiguration = async () => {
    setLoading(true);
    setStatus(null);
    setError(null);

    const config: Record<string, string> = {};

    if (siteId.trim()) {
      config.siteId = siteId.trim();
    }
    if (appApiKey.trim()) {
      config.appApiKey = appApiKey.trim();
    }
    if (transactionalApiKey.trim()) {
      config.transactionalApiKey = transactionalApiKey.trim();
    }
    if (transactionalMessageId.trim()) {
      config.transactionalMessageId = transactionalMessageId.trim();
    }
    if (region.trim()) {
      config.region = region.trim();
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

    try {
      const response = await fetch("/api/email/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "customerio",
          config,
          setActive,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to save configuration");
      }

      const data = await response.json();
      const providerSummary = extractCustomerioSummary(
        data.provider ? [data.provider] : []
      );
      if (providerSummary) {
        setSummary(providerSummary);
      }
      if (data.active) {
        setSetActive(data.active.id === "customerio");
      }
      setStatus("Customer.io settings saved successfully");
      setAppApiKey("");
      setTransactionalApiKey("");
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

  const activateProvider = async () => {
    setLoading(true);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch("/api/email/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "customerio" }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to activate provider");
      }

      const data = await response.json();
      const providerSummary = extractCustomerioSummary(
        data.provider ? [data.provider] : []
      );
      if (providerSummary) {
        setSummary(providerSummary);
        setSetActive(true);
      }
      setStatus("Customer.io is now the active provider");
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
          <Link href="/integrations/customerio" className="flex items-center gap-1">
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Connect Customer.io</CardTitle>
          <CardDescription>
            Add your Customer.io credentials and configure the transactional
            message that should deliver patch notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {status && <p className="text-sm text-muted-foreground">{status}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerio-site-id">Site ID</Label>
              <Input
                id="customerio-site-id"
                placeholder="your-site-id"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerio-region">Region</Label>
              <select
                id="customerio-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="us">United States</option>
                <option value="eu">European Union</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerio-app-key">App API Key</Label>
              <Input
                id="customerio-app-key"
                type="password"
                placeholder="app_..."
                value={appApiKey}
                onChange={(e) => setAppApiKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerio-transactional-key">
                Transactional API Key
              </Label>
              <Input
                id="customerio-transactional-key"
                type="password"
                placeholder="tr_..."
                value={transactionalApiKey}
                onChange={(e) => setTransactionalApiKey(e.target.value)}
              />
            </div>
          </div>
          {hasStoredKeys && !appApiKey && !transactionalApiKey && (
            <p className="text-xs text-muted-foreground">
              Keys are already stored. Enter new keys to rotate credentials.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="customerio-transactional-message">
              Transactional Message ID
            </Label>
            <Input
              id="customerio-transactional-message"
              placeholder="10000001"
              value={transactionalMessageId}
              onChange={(e) => setTransactionalMessageId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Choose the message ID from Customer.io's transactional email
              editor.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerio-from-email">From Email</Label>
              <Input
                id="customerio-from-email"
                type="email"
                placeholder="updates@yourdomain.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerio-from-name">From Name</Label>
              <Input
                id="customerio-from-name"
                placeholder="Repatch"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerio-reply-to">Reply-to Email</Label>
            <Input
              id="customerio-reply-to"
              type="email"
              placeholder="support@yourdomain.com"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="customerio-set-active"
              type="checkbox"
              checked={setActive}
              onChange={(event) => setSetActive(event.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="customerio-set-active" className="font-normal">
              Set Customer.io as the active provider after saving
            </Label>
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <div className="text-xs text-muted-foreground">
            Current status: {summary?.isActive ? "Active" : "Inactive"}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={activateProvider} disabled={loading}>
              Make Active
            </Button>
            <Button onClick={saveConfiguration} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
