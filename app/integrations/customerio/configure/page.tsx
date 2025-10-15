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

interface ProviderState {
  fromEmail?: string;
  isActive?: boolean;
  configured?: boolean;
  managedByEnv?: boolean;
}

export default function CustomerIOConfigurePage() {
  const [siteId, setSiteId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [appKey, setAppKey] = useState("");
  const [transactionalMessageId, setTransactionalMessageId] = useState("");
  const [region, setRegion] = useState("us");
  const [fromEmail, setFromEmail] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerState, setProviderState] = useState<ProviderState>({});

  useEffect(() => {
    const loadProvider = async () => {
      try {
        const response = await fetch("/api/email/providers/customerio");
        if (!response.ok) {
          throw new Error("Failed to load provider");
        }
        const data = await response.json();
        setProviderState(data);
        setFromEmail(data.fromEmail ?? "");
        setIsActive(Boolean(data.isActive));
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };

    loadProvider();
  }, []);

  const onSave = async () => {
    setStatus(null);
    setError(null);

    const trimmedFromEmail = fromEmail.trim();
    const trimmedSiteId = siteId.trim();
    const trimmedApiKey = apiKey.trim();
    const trimmedAppKey = appKey.trim();
    const trimmedTransactional = transactionalMessageId.trim();
    const trimmedRegion = region.trim();

    if (!trimmedFromEmail) {
      setError("From email is required");
      return;
    }

    const requiresAll = !providerState.configured;

    if (requiresAll) {
      if (!trimmedSiteId || !trimmedApiKey || !trimmedAppKey || !trimmedTransactional) {
        setError("All Customer.io credentials are required");
        return;
      }
    }

    setSaving(true);

    try {
      const credentials: Record<string, string> = {};
      if (trimmedSiteId) credentials.siteId = trimmedSiteId;
      if (trimmedApiKey) credentials.apiKey = trimmedApiKey;
      if (trimmedAppKey) credentials.appKey = trimmedAppKey;
      if (trimmedTransactional)
        credentials.transactionalMessageId = trimmedTransactional;
      if (trimmedRegion) credentials.region = trimmedRegion;

      const response = await fetch("/api/email/providers/customerio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromEmail: trimmedFromEmail,
          credentials,
          isActive,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to save provider");
      }

      const data = await response.json();
      setStatus("Customer.io configuration saved");
      setProviderState(data);
      setFromEmail(data.fromEmail ?? trimmedFromEmail);
      if (trimmedSiteId) setSiteId("");
      if (trimmedApiKey) setApiKey("");
      if (trimmedAppKey) setAppKey("");
      if (trimmedTransactional) setTransactionalMessageId("");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
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
            Provide your Customer.io credentials and transactional message to
            deliver patch notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providerState.managedByEnv && (
            <div className="rounded-md border border-dashed border-muted-foreground/30 p-3 text-xs text-muted-foreground">
              Customer.io is currently configured via environment variables.
              Saving will store credentials in Supabase instead.
            </div>
          )}
          {status && (
            <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {status}
            </div>
          )}
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Site ID</label>
              <Input
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                placeholder="your-site-id"
                disabled={loading || saving}
              />
            </div>
            <div>
              <label className="text-sm font-medium">API Key</label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="cio_api_key"
                disabled={loading || saving}
              />
            </div>
            <div>
              <label className="text-sm font-medium">App API Key</label>
              <Input
                type="password"
                value={appKey}
                onChange={(e) => setAppKey(e.target.value)}
                placeholder="cio_app_key"
                disabled={loading || saving}
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Transactional Message ID
              </label>
              <Input
                value={transactionalMessageId}
                onChange={(e) => setTransactionalMessageId(e.target.value)}
                placeholder="123456"
                disabled={loading || saving}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Region</label>
              <select
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={loading || saving}
              >
                <option value="us">US</option>
                <option value="eu">EU</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium">From Email</label>
              <Input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="Patch Notes <patch@yourdomain.com>"
                disabled={loading || saving}
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <input
                id="customerio-active"
                type="checkbox"
                className="h-4 w-4 rounded border-muted"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={loading || saving}
              />
              <label htmlFor="customerio-active" className="text-sm">
                Set Customer.io as the active email provider
              </label>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href="/integrations">Cancel</Link>
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
