"use client";

import Link from "next/link";
import { useState, useEffect, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  UsersIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  CheckCircleIcon,
  BoltIcon,
} from "@heroicons/react/16/solid";

type EmailProviderName = "resend" | "customer_io";

interface Subscriber {
  id: string;
  email: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProviderSummary {
  id: string;
  provider: EmailProviderName;
  displayName: string | null;
  fromEmail: string;
  hasApiKey: boolean;
  audienceId?: string | null;
  siteId?: string | null;
  transactionalMessageId?: string | null;
  metadata: Record<string, unknown>;
  isActive: boolean;
}

type IntegrationFormState = {
  fromEmail: string;
  apiKey: string;
  audienceId?: string;
  siteId?: string;
  trackApiKey?: string;
  transactionalMessageId?: string;
  region?: string;
};

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<ProviderSummary[]>([]);
  const [activeIntegration, setActiveIntegration] =
    useState<ProviderSummary | null>(null);
  const [integrationLoading, setIntegrationLoading] = useState(true);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<EmailProviderName, IntegrationFormState>>({
    resend: { fromEmail: "", apiKey: "", audienceId: "" },
    customer_io: {
      fromEmail: "",
      apiKey: "",
      siteId: "",
      trackApiKey: "",
      transactionalMessageId: "",
      region: "",
    },
  });
  const [savingProvider, setSavingProvider] = useState<EmailProviderName | null>(null);
  const [activatingProvider, setActivatingProvider] =
    useState<EmailProviderName | null>(null);

  const loadSubscribers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/subscribers");
      if (!response.ok) {
        throw new Error("Failed to fetch subscribers");
      }
      const data = await response.json();
      if (Array.isArray(data.subscribers)) {
        setSubscribers(data.subscribers);
      } else if (Array.isArray(data)) {
        setSubscribers(data);
      } else {
        setSubscribers([]);
      }
      if (data.integration) {
        setActiveIntegration(data.integration);
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch subscribers"
      );
    } finally {
      setLoading(false);
    }
  };

  const loadIntegrations = async () => {
    setIntegrationLoading(true);
    setIntegrationError(null);
    try {
      const response = await fetch("/api/email-integrations");
      if (!response.ok) {
        throw new Error("Failed to load integrations");
      }
      const data = await response.json();
      const fetched: ProviderSummary[] = Array.isArray(data.integrations)
        ? data.integrations
        : [];
      setIntegrations(fetched);
      if (data.active) {
        setActiveIntegration(data.active);
      }

      const nextForm: Record<EmailProviderName, IntegrationFormState> = {
        resend: { fromEmail: "", apiKey: "", audienceId: "" },
        customer_io: {
          fromEmail: "",
          apiKey: "",
          siteId: "",
          trackApiKey: "",
          transactionalMessageId: "",
          region: "",
        },
      };

      fetched.forEach((integration) => {
        if (integration.provider === "resend") {
          nextForm.resend = {
            fromEmail: integration.fromEmail || "",
            apiKey: "",
            audienceId: integration.audienceId ?? "",
          };
        }

        if (integration.provider === "customer_io") {
          const metadataRegion =
            integration.metadata &&
            typeof (integration.metadata as Record<string, unknown>)["region"] ===
              "string"
              ? ((integration.metadata as Record<string, unknown>)[
                  "region"
                ] as string)
              : "";

          nextForm.customer_io = {
            fromEmail: integration.fromEmail || "",
            apiKey: "",
            siteId: integration.siteId ?? "",
            trackApiKey: "",
            transactionalMessageId: integration.transactionalMessageId ?? "",
            region: metadataRegion,
          };
        }
      });

      setFormState(nextForm);
    } catch (err) {
      setIntegrationError(
        err instanceof Error ? err.message : "Failed to load integrations"
      );
    } finally {
      setIntegrationLoading(false);
    }
  };

  useEffect(() => {
    loadSubscribers();
    loadIntegrations();
  }, []);

  const handleFieldChange = (
    provider: EmailProviderName,
    field: keyof IntegrationFormState
  ) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setFormState((prev) => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          [field]: value,
        },
      }));
    };

  const handleSaveIntegration = async (provider: EmailProviderName) => {
    const form = formState[provider];
    const integration = integrations.find((item) => item.provider === provider);
    const payload: Record<string, unknown> = { provider };

    if (form.fromEmail) payload.fromEmail = form.fromEmail;
    if (form.apiKey) payload.apiKey = form.apiKey;

    if (provider === "resend") {
      if (form.audienceId) payload.audienceId = form.audienceId;
    }

    if (provider === "customer_io") {
      if (form.siteId) payload.siteId = form.siteId;
      if (form.trackApiKey) payload.trackApiKey = form.trackApiKey;
      if (form.transactionalMessageId)
        payload.transactionalMessageId = form.transactionalMessageId;
      if (form.region) payload.metadata = { region: form.region };
    }

    if (integration?.isActive) {
      payload.isActive = true;
    }

    setSavingProvider(provider);
    try {
      setIntegrationError(null);
      const response = await fetch("/api/email-integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to save integration");
      }

      await loadIntegrations();
      await loadSubscribers();
    } catch (err) {
      setIntegrationError(
        err instanceof Error ? err.message : "Failed to save integration"
      );
    } finally {
      setSavingProvider(null);
    }
  };

  const handleActivateProvider = async (provider: EmailProviderName) => {
    setActivatingProvider(provider);
    try {
      setIntegrationError(null);
      const response = await fetch("/api/email-integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to update provider");
      }

      await loadIntegrations();
      await loadSubscribers();
    } catch (err) {
      setIntegrationError(
        err instanceof Error
          ? err.message
          : "Failed to update provider"
      );
    } finally {
      setActivatingProvider(null);
    }
  };

  const activeSubscribers = subscribers.filter((sub) => sub.active);
  const totalSubscribers = subscribers.length;
  const providerLabel =
    activeIntegration?.provider === "customer_io" ? "Customer.io" : "Resend";
  const providerManageUrl =
    activeIntegration?.provider === "customer_io"
      ? "https://fly.customer.io"
      : "https://resend.com";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <UsersIcon className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Subscribers
            </h1>
            <p className="text-muted-foreground">
              Manage your patch notes newsletter subscribers
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeIntegration ? (
            <Button variant="outline" asChild>
              <Link
                href={providerManageUrl}
                target="_blank"
                className="flex items-center gap-1"
              >
                Manage in {providerLabel}
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Connect an email provider
            </Button>
          )}
        </div>
      </div>

      {/* Provider Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BoltIcon className="h-5 w-5" />
            Email Provider
          </CardTitle>
          <CardDescription>
            {activeIntegration
              ? `Campaigns will be delivered using ${providerLabel}.`
              : "Connect Resend or Customer.io to send newsletters."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {integrationLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              Loading providers...
            </div>
          ) : integrationError ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <ExclamationTriangleIcon className="h-4 w-4" />
              {integrationError}
            </div>
          ) : (
            <div className="space-y-6">
              {integrations.map((integration) => {
                const form = formState[integration.provider];
                const isSaving = savingProvider === integration.provider;
                const isActivating = activatingProvider === integration.provider;
                const providerName =
                  integration.provider === "customer_io"
                    ? "Customer.io"
                    : "Resend";

                return (
                  <div
                    key={integration.provider}
                    className="rounded-lg border p-4 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{providerName}</span>
                          {integration.isActive ? (
                            <Badge
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              <CheckCircleIcon className="h-3.5 w-3.5" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                          {integration.hasApiKey ? (
                            <Badge variant="secondary">API key stored</Badge>
                          ) : (
                            <Badge variant="destructive">API key missing</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {integration.provider === "customer_io"
                            ? "Use Customer.io transactional messaging to deliver patch notes."
                            : "Send newsletters through your Resend audience."}
                        </p>
                      </div>
                      {!integration.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivateProvider(integration.provider)}
                          disabled={isActivating}
                        >
                          {isActivating ? "Activating..." : "Set Active"}
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`${integration.provider}-from`}>
                          From Email
                        </Label>
                        <Input
                          id={`${integration.provider}-from`}
                          value={form.fromEmail}
                          onChange={handleFieldChange(
                            integration.provider,
                            "fromEmail"
                          )}
                          placeholder="Repatch <newsletters@example.com>"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${integration.provider}-api-key`}>
                          {providerName} API Key
                        </Label>
                        <Input
                          id={`${integration.provider}-api-key`}
                          type="password"
                          value={form.apiKey}
                          onChange={handleFieldChange(
                            integration.provider,
                            "apiKey"
                          )}
                          placeholder="Enter a new API key"
                        />
                        <p className="text-xs text-muted-foreground">
                          {integration.hasApiKey
                            ? "Keys are stored securely. Leave blank to keep the current key."
                            : "Add an API key before sending campaigns."}
                        </p>
                      </div>

                      {integration.provider === "resend" && (
                        <div className="space-y-2">
                          <Label htmlFor="resend-audience">Audience ID</Label>
                          <Input
                            id="resend-audience"
                            value={form.audienceId ?? ""}
                            onChange={handleFieldChange(
                              "resend",
                              "audienceId"
                            )}
                            placeholder="fa2a9141-..."
                          />
                        </div>
                      )}

                      {integration.provider === "customer_io" && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="customer-io-site">Workspace Site ID</Label>
                            <Input
                              id="customer-io-site"
                              value={form.siteId ?? ""}
                              onChange={handleFieldChange(
                                "customer_io",
                                "siteId"
                              )}
                              placeholder="site_123"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="customer-io-track">Track API Key</Label>
                            <Input
                              id="customer-io-track"
                              type="password"
                              value={form.trackApiKey ?? ""}
                              onChange={handleFieldChange(
                                "customer_io",
                                "trackApiKey"
                              )}
                              placeholder="Provide the track API key"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="customer-io-transactional">
                              Transactional Message ID
                            </Label>
                            <Input
                              id="customer-io-transactional"
                              value={form.transactionalMessageId ?? ""}
                              onChange={handleFieldChange(
                                "customer_io",
                                "transactionalMessageId"
                              )}
                              placeholder="Optional: reuse an existing message"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="customer-io-region">Region</Label>
                            <Input
                              id="customer-io-region"
                              value={form.region ?? ""}
                              onChange={handleFieldChange(
                                "customer_io",
                                "region"
                              )}
                              placeholder="us or eu"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <Button
                        size="sm"
                        onClick={() => handleSaveIntegration(integration.provider)}
                        disabled={isSaving}
                      >
                        {isSaving ? "Saving..." : "Save settings"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audience Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Audience Configuration
          </CardTitle>
          <CardDescription>
            {activeIntegration
              ? `Your ${providerLabel} configuration for patch notes subscribers`
              : "Connect a provider to view subscriber settings."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeIntegration ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    From Email
                  </label>
                  <div className="mt-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
                    {activeIntegration.fromEmail || "Not configured"}
                  </div>
                </div>

                {activeIntegration.provider === "resend" && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Audience ID
                    </label>
                    <div className="mt-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
                      {activeIntegration.audienceId || "Not configured"}
                    </div>
                  </div>
                )}

                {activeIntegration.provider === "customer_io" && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Workspace Site ID
                      </label>
                      <div className="mt-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
                        {activeIntegration.siteId || "Not configured"}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Transactional Message
                      </label>
                      <div className="mt-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
                        {activeIntegration.transactionalMessageId || "Not set"}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No provider connected. Configure Resend or Customer.io above to view subscriber settings.
              </div>
            )}

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Loading subscribers...
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <ExclamationTriangleIcon className="h-4 w-4" />
                {error}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{totalSubscribers}</div>
                  <div className="text-sm text-muted-foreground">
                    Total Subscribers
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {activeSubscribers.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Active Subscribers
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {totalSubscribers - activeSubscribers.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Unsubscribed
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          {activeIntegration ? (
            <Button variant="outline" asChild>
              <Link
                href={providerManageUrl}
                target="_blank"
                className="flex items-center gap-1"
              >
                Manage in {providerLabel}
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Connect an email provider
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* All Subscribers */}
      {!loading && !error && subscribers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Subscribers</CardTitle>
            <CardDescription>
              Complete list of your audience subscribers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {subscribers.map((subscriber) => (
                <div
                  key={subscriber.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div>
                    <div className="font-medium">{subscriber.email}</div>
                    <div className="text-sm text-muted-foreground">
                      Added{" "}
                      {new Date(subscriber.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      subscriber.active
                        ? "bg-green-100 text-green-800"
                        : "bg-orange-100 text-orange-800"
                    }`}
                  >
                    {subscriber.active ? "Active" : "Unsubscribed"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              variant="outline"
              asChild={Boolean(activeIntegration)}
              disabled={!activeIntegration}
            >
              {activeIntegration ? (
                <Link
                  href={providerManageUrl}
                  target="_blank"
                  className="flex items-center gap-1"
                >
                  View All in {providerLabel}
                  <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <span className="flex items-center gap-1">
                  Connect an email provider
                </span>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && subscribers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UsersIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No subscribers yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Your audience is empty. Add subscribers through {providerLabel}
              {" "}
              or your signup forms.
            </p>
            <Button
              variant="outline"
              asChild={Boolean(activeIntegration)}
              disabled={!activeIntegration}
            >
              {activeIntegration ? (
                <Link
                  href={providerManageUrl}
                  target="_blank"
                  className="flex items-center gap-1"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Subscribers in {providerLabel}
                </Link>
              ) : (
                <span className="flex items-center gap-1">
                  <PlusIcon className="h-4 w-4" />
                  Connect an email provider above
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ExclamationTriangleIcon className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Failed to load subscribers
            </h3>
            <p className="text-muted-foreground text-center mb-4">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
