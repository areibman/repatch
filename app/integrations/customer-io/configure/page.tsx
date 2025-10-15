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
import { Badge } from "@/components/ui/badge";
import { ArrowLeftIcon } from "@heroicons/react/16/solid";

import { SanitizedIntegrationConfig } from "@/lib/email/types";

export default function CustomerIoConfigurePage() {
  const [siteId, setSiteId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [appKey, setAppKey] = useState("");
  const [transactionalMessageId, setTransactionalMessageId] = useState("");
  const [region, setRegion] = useState("us");
  const [fromEmail, setFromEmail] = useState("");
  const [setActive, setSetActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerConfig, setProviderConfig] = useState<
    SanitizedIntegrationConfig | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/email-integrations");
        const data: {
          providers: SanitizedIntegrationConfig[];
          activeProvider: SanitizedIntegrationConfig | null;
        } = await response.json();

        if (!response.ok) {
          throw new Error("Failed to load provider configuration");
        }

        if (cancelled) return;

        const integration = data.providers.find(
          (provider) => provider.provider === "customerio"
        );

        if (integration) {
          setProviderConfig(integration);
          setFromEmail(integration.fromEmail ?? "");
          const savedSiteId = (integration.config as Record<string, string>)[
            "siteId"
          ];
          if (savedSiteId) {
            setSiteId(savedSiteId);
          }
          const transactionalId = (integration.config as Record<string, string>)[
            "transactionalMessageId"
          ];
          if (transactionalId) {
            setTransactionalMessageId(transactionalId);
          }
          const savedRegion = (integration.config as Record<string, string>)[
            "region"
          ];
          if (savedRegion) {
            setRegion(savedRegion);
          }

          setSetActive(integration.isActive);
        }
      } catch (error) {
        if (cancelled) return;
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load configuration"
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const configuredFromEnv = useMemo(() => {
    return providerConfig?.source === "environment";
  }, [providerConfig]);

  const handleSubmit = async () => {
    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/email-integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "customerio",
          config: {
            siteId,
            apiKey,
            appKey,
            transactionalMessageId,
            region,
          },
          fromEmail,
          setActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save configuration");
      }

      setStatus("Customer.io configuration saved successfully.");
      if (data?.provider) {
        setProviderConfig(data.provider);
        const savedSiteId = (data.provider.config as Record<string, string>)[
          "siteId"
        ];
        if (savedSiteId) {
          setSiteId(savedSiteId);
        }
        const savedMessageId = (data.provider.config as Record<string, string>)[
          "transactionalMessageId"
        ];
        if (savedMessageId) {
          setTransactionalMessageId(savedMessageId);
        }
        const savedRegion = (data.provider.config as Record<string, string>)[
          "region"
        ];
        if (savedRegion) {
          setRegion(savedRegion);
        }
        setFromEmail(data.provider.fromEmail ?? "");
        setSetActive(data.provider.isActive);
      }
      setApiKey("");
      setAppKey("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to save Customer.io configuration"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/integrations/customer-io" className="flex items-center gap-1">
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connect Customer.io</CardTitle>
              <CardDescription>
                Provide your Customer.io credentials and defaults. Secrets are
                stored securely in Supabase.
              </CardDescription>
            </div>
            {providerConfig?.configured && (
              <Badge variant={providerConfig.isActive ? "default" : "secondary"}>
                {providerConfig.isActive ? "Active" : "Configured"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {configuredFromEnv && (
            <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
              This provider is currently configured via environment variables. You
              can override fields below to use database stored credentials.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Site ID</label>
              <Input
                placeholder="site_123..."
                value={siteId}
                onChange={(event) => setSiteId(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Track API Key</label>
              <Input
                type="password"
                placeholder="Enter API key"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">App API Key</label>
              <Input
                type="password"
                placeholder="Enter App API key"
                value={appKey}
                onChange={(event) => setAppKey(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Transactional Message ID
              </label>
              <Input
                placeholder="message_123"
                value={transactionalMessageId}
                onChange={(event) => setTransactionalMessageId(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Region</label>
              <Input
                placeholder="us or eu"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">From Email</label>
              <Input
                placeholder="Patch Notes <patch@example.com>"
                value={fromEmail}
                onChange={(event) => setFromEmail(event.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
            <input
              id="customerio-set-active"
              type="checkbox"
              className="h-4 w-4"
              checked={setActive}
              onChange={(event) => setSetActive(event.target.checked)}
            />
            <label htmlFor="customerio-set-active" className="cursor-pointer">
              Make Customer.io the active email provider
            </label>
          </div>

          {status && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
              {status}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href="/integrations/customer-io">Cancel</Link>
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || isLoading}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
