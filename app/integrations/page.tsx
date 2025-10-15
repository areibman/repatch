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
import {
  CodeBracketIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/16/solid";

import { EmailProviderId, SanitizedIntegrationConfig } from "@/lib/email/types";

type IntegrationItem = {
  id: "github" | "resend" | "customerio";
  name: string;
  description: string;
  href: string;
  configureHref: string;
  badge?: { label: string; variant?: "default" | "secondary" | "outline" };
  icon: React.ReactNode;
  emailProviderId?: EmailProviderId;
};

const INTEGRATIONS: IntegrationItem[] = [
  {
    id: "github",
    name: "GitHub",
    description:
      "Connect a repository to generate AI patch notes from commits, PRs, and releases.",
    href: "/integrations/github",
    configureHref: "/integrations/github/configure",
    badge: { label: "Source", variant: "outline" },
    icon: <CodeBracketIcon className="h-5 w-5" />,
  },
  {
    id: "resend",
    name: "Resend",
    description:
      "Send your patch notes newsletter via Resend with your preferred sender.",
    href: "/integrations/resend",
    configureHref: "/integrations/resend/configure",
    badge: { label: "Email", variant: "outline" },
    icon: <EnvelopeIcon className="h-5 w-5" />,
    emailProviderId: "resend",
  },
  {
    id: "customerio",
    name: "Customer.io",
    description:
      "Deliver transactional patch notes with Customer.io's email automation.",
    href: "/integrations/customer-io",
    configureHref: "/integrations/customer-io/configure",
    badge: { label: "Email", variant: "outline" },
    icon: <EnvelopeIcon className="h-5 w-5" />,
    emailProviderId: "customerio",
  },
];

export default function IntegrationsPage() {
  const [query, setQuery] = useState("");
  const [providerMap, setProviderMap] = useState<
    Record<EmailProviderId, SanitizedIntegrationConfig>
  >({});
  const [activeProvider, setActiveProvider] = useState<EmailProviderId | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [changingProvider, setChangingProvider] = useState<EmailProviderId | null>(
    null
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INTEGRATIONS;
    return INTEGRATIONS.filter((i) =>
      [i.name, i.description, i.id].some((t) => t.toLowerCase().includes(q))
    );
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function loadProviders() {
      setLoadingProviders(true);
      setProviderError(null);
      try {
        const response = await fetch("/api/email-integrations");
        const data: {
          providers: SanitizedIntegrationConfig[];
          activeProvider: SanitizedIntegrationConfig | null;
          error?: string;
        } = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load providers");
        }

        if (cancelled) return;

        const map: Record<EmailProviderId, SanitizedIntegrationConfig> = {};
        for (const integration of data.providers ?? []) {
          map[integration.provider] = integration;
        }
        setProviderMap(map);
        setActiveProvider(data.activeProvider?.provider ?? null);
      } catch (error) {
        if (cancelled) return;
        setProviderError(
          error instanceof Error
            ? error.message
            : "Unable to load provider configuration"
        );
        setProviderMap({});
        setActiveProvider(null);
      } finally {
        if (!cancelled) {
          setLoadingProviders(false);
        }
      }
    }

    loadProviders();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleActivate = async (providerId: EmailProviderId) => {
    setChangingProvider(providerId);
    setProviderError(null);

    try {
      const response = await fetch("/api/email-integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId }),
      });

      const data: {
        providers: SanitizedIntegrationConfig[];
        activeProvider: SanitizedIntegrationConfig | null;
        error?: string;
      } = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to activate provider");
      }

      const map: Record<EmailProviderId, SanitizedIntegrationConfig> = {};
      for (const integration of data.providers ?? []) {
        map[integration.provider] = integration;
      }

      setProviderMap(map);
      setActiveProvider(data.activeProvider?.provider ?? null);
    } catch (error) {
      setProviderError(
        error instanceof Error
          ? error.message
          : "Unable to update active provider"
      );
    } finally {
      setChangingProvider(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Sources & Integrations
        </h1>
        <p className="text-muted-foreground mt-1">
          Connect sources to generate patch notes and delivery integrations to
          send them.
        </p>
      </div>

      <div className="relative mb-8">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search for sources or integrations..."
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {providerError && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {providerError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item) => {
          const providerInfo = item.emailProviderId
            ? providerMap[item.emailProviderId]
            : undefined;
          const isActive = item.emailProviderId
            ? activeProvider === item.emailProviderId
            : false;

          return (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <CardTitle className="text-base">{item.name}</CardTitle>
                </div>
                {item.badge && (
                  <Badge variant={item.badge.variant}>{item.badge.label}</Badge>
                )}
              </div>
              <CardDescription className="mt-2">
                {item.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {item.emailProviderId && (
                <div className="space-y-3 text-sm text-muted-foreground">
                  {loadingProviders ? (
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                      Checking provider status...
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            isActive
                              ? "default"
                              : providerInfo?.configured
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {isActive
                            ? "Active"
                            : providerInfo?.configured
                            ? "Available"
                            : "Not configured"}
                        </Badge>
                        {providerInfo?.source === "environment" && (
                          <Badge variant="outline">Env</Badge>
                        )}
                      </div>
                      <div>
                        {providerInfo?.configured ? (
                          <>
                            <p className="text-foreground">
                              From: {providerInfo.fromEmail ?? "Not set"}
                            </p>
                            <dl className="mt-2 grid gap-1 text-xs text-foreground">
                              {providerInfo.config &&
                                "audienceId" in providerInfo.config &&
                                (providerInfo.config as Record<string, string>)[
                                  "audienceId"
                                ] && (
                                  <div>
                                    <dt className="font-medium text-muted-foreground">
                                      Audience
                                    </dt>
                                    <dd>
                                      {
                                        (providerInfo.config as Record<string, string>)[
                                          "audienceId"
                                        ]
                                      }
                                    </dd>
                                  </div>
                                )}
                              {providerInfo.config &&
                                "transactionalMessageId" in providerInfo.config &&
                                (providerInfo.config as Record<string, string>)[
                                  "transactionalMessageId"
                                ] && (
                                  <div>
                                    <dt className="font-medium text-muted-foreground">
                                      Message ID
                                    </dt>
                                    <dd>
                                      {
                                        (providerInfo.config as Record<string, string>)[
                                          "transactionalMessageId"
                                        ]
                                      }
                                    </dd>
                                  </div>
                                )}
                              {providerInfo.config &&
                                "region" in providerInfo.config &&
                                (providerInfo.config as Record<string, string>)[
                                  "region"
                                ] && (
                                  <div>
                                    <dt className="font-medium text-muted-foreground">
                                      Region
                                    </dt>
                                    <dd>
                                      {
                                        (providerInfo.config as Record<string, string>)[
                                          "region"
                                        ]
                                      }
                                    </dd>
                                  </div>
                                )}
                            </dl>
                          </>
                        ) : (
                          <p>
                            Connect this provider to manage credentials and sender
                            defaults.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-2">
              <Button asChild>
                <Link href={item.configureHref}>
                  {item.emailProviderId && providerInfo?.configured
                    ? "Manage"
                    : "Connect"}
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                {item.emailProviderId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={
                      loadingProviders ||
                      changingProvider === item.emailProviderId ||
                      isActive ||
                      !providerInfo?.configured
                    }
                    onClick={() => handleActivate(item.emailProviderId!)}
                  >
                    {isActive
                      ? "Active"
                      : changingProvider === item.emailProviderId
                      ? "Switching..."
                      : "Set Active"}
                  </Button>
                )}
                <Button variant="ghost" size="sm" asChild>
                  <Link href={item.href} className="flex items-center gap-1">
                    Learn more
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardFooter>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
