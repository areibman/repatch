"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EmailIntegrationConfig, EmailProvider } from "@/types/email";
import { EMAIL_PROVIDER_LABELS } from "@/lib/email/providers";

interface ProvidersResponse {
  providers: EmailIntegrationConfig[];
  active: EmailIntegrationConfig | null;
}

interface ResendFormState {
  apiKey: string;
  audienceId: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
}

interface CustomerIoFormState {
  appApiKey: string;
  region: "us" | "eu";
  fromEmail: string;
  fromName: string;
}

interface SecretState {
  resendApiKey: boolean;
  customerIoApiKey: boolean;
}

const initialResendState: ResendFormState = {
  apiKey: "",
  audienceId: "",
  fromEmail: "",
  fromName: "",
  replyTo: "",
};

const initialCustomerState: CustomerIoFormState = {
  appApiKey: "",
  region: "us",
  fromEmail: "",
  fromName: "",
};

const managementLinks: Record<EmailProvider, string> = {
  resend: "https://resend.com",
  customerio: "https://app.customer.io",
};

export default function EmailSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<EmailIntegrationConfig[]>([]);
  const [activeProvider, setActiveProvider] = useState<EmailProvider | null>(null);
  const [resendForm, setResendForm] = useState(initialResendState);
  const [customerForm, setCustomerForm] = useState(initialCustomerState);
  const [secrets, setSecrets] = useState<SecretState>({
    resendApiKey: false,
    customerIoApiKey: false,
  });
  const [savingProvider, setSavingProvider] = useState<EmailProvider | null>(null);
  const [activatingProvider, setActivatingProvider] = useState<EmailProvider | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchIntegrations = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/email/providers");
        if (!response.ok) {
          throw new Error("Failed to load provider configuration");
        }

        const data = (await response.json()) as ProvidersResponse;
        setProviders(data.providers);
        setActiveProvider(data.active?.provider ?? null);

        data.providers.forEach((provider) => {
          if (provider.provider === "resend") {
            const settings = provider.settings as any;
            setResendForm((current) => ({
              ...current,
              audienceId: settings.audienceId ?? "",
              fromEmail: settings.fromEmail ?? "",
              fromName: settings.fromName ?? "",
              replyTo: settings.replyTo ?? "",
              apiKey: "",
            }));
            setSecrets((current) => ({
              ...current,
              resendApiKey: settings.apiKey === "********",
            }));
          }

          if (provider.provider === "customerio") {
            const settings = provider.settings as any;
            setCustomerForm((current) => ({
              ...current,
              region: settings.region === "eu" ? "eu" : "us",
              fromEmail: settings.fromEmail ?? "",
              fromName: settings.fromName ?? "",
              appApiKey: "",
            }));
            setSecrets((current) => ({
              ...current,
              customerIoApiKey: settings.appApiKey === "********",
            }));
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load providers");
      } finally {
        setLoading(false);
      }
    };

    fetchIntegrations();
  }, []);

  const resendConfigured = useMemo(
    () => providers.some((config) => config.provider === "resend"),
    [providers]
  );

  const customerConfigured = useMemo(
    () => providers.some((config) => config.provider === "customerio"),
    [providers]
  );

  const handleSave = async (provider: EmailProvider, activate = false) => {
    setSavingProvider(provider);
    setSuccessMessage(null);
    try {
      const body: {
        provider: EmailProvider;
        settings: Record<string, unknown>;
        activate?: boolean;
      } = {
        provider,
        settings: {},
      };

      if (activate) {
        body.activate = true;
      }

      if (provider === "resend") {
        const settings: Record<string, unknown> = {
          audienceId: resendForm.audienceId,
          fromEmail: resendForm.fromEmail,
          fromName: resendForm.fromName,
          replyTo: resendForm.replyTo,
        };

        if (resendForm.apiKey || !secrets.resendApiKey) {
          settings.apiKey = resendForm.apiKey;
        }

        body.settings = settings;
      }

      if (provider === "customerio") {
        const settings: Record<string, unknown> = {
          region: customerForm.region,
          fromEmail: customerForm.fromEmail,
          fromName: customerForm.fromName,
        };

        if (customerForm.appApiKey || !secrets.customerIoApiKey) {
          settings.appApiKey = customerForm.appApiKey;
        }

        body.settings = settings;
      }

      const response = await fetch("/api/email/providers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({ error: "Failed to save provider" }));
        throw new Error(errorPayload.error || "Failed to save provider");
      }

      const saved = (await response.json()) as EmailIntegrationConfig;
      setProviders((current) => {
        const existingIndex = current.findIndex((item) => item.provider === provider);
        if (existingIndex === -1) {
          return [...current, saved];
        }
        const next = [...current];
        next[existingIndex] = saved;
        return next;
      });

      if (saved.isActive) {
        setActiveProvider(saved.provider);
      }

      if (provider === "resend" && resendForm.apiKey) {
        setResendForm((current) => ({ ...current, apiKey: "" }));
        setSecrets((current) => ({ ...current, resendApiKey: true }));
      }

      if (provider === "customerio" && customerForm.appApiKey) {
        setCustomerForm((current) => ({ ...current, appApiKey: "" }));
        setSecrets((current) => ({ ...current, customerIoApiKey: true }));
      }

      setSuccessMessage("Provider settings saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save provider");
    } finally {
      setSavingProvider(null);
    }
  };

  const handleActivate = async (provider: EmailProvider) => {
    setActivatingProvider(provider);
    setSuccessMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/email/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to activate provider" }));
        throw new Error(payload.error || "Failed to activate provider");
      }

      const activated = (await response.json()) as EmailIntegrationConfig;
      setActiveProvider(activated.provider);
      setProviders((current) => {
        const updated = current.map((config) =>
          config.provider === activated.provider
            ? activated
            : { ...config, isActive: false }
        );
        return updated;
      });
      setSuccessMessage(`${EMAIL_PROVIDER_LABELS[provider]} is now active.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate provider");
    } finally {
      setActivatingProvider(null);
    }
  };

  const renderResendCard = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {EMAIL_PROVIDER_LABELS.resend}
              {activeProvider === "resend" && <Badge variant="outline">Active</Badge>}
            </CardTitle>
            <CardDescription>Transactional email delivery through Resend.</CardDescription>
          </div>
          <Button variant="outline" asChild>
            <Link href={managementLinks.resend} target="_blank" rel="noreferrer">
              Manage in Resend
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="resend-api-key">API Key</Label>
            <Input
              id="resend-api-key"
              placeholder={secrets.resendApiKey ? "Configured" : "re_"}
              value={resendForm.apiKey}
              onChange={(event) =>
                setResendForm((current) => ({ ...current, apiKey: event.target.value }))
              }
              type="password"
            />
            {secrets.resendApiKey && (
              <p className="text-xs text-muted-foreground">
                A key is already stored. Enter a new key to replace it.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="resend-audience">Audience ID</Label>
            <Input
              id="resend-audience"
              placeholder="fa2a9141-..."
              value={resendForm.audienceId}
              onChange={(event) =>
                setResendForm((current) => ({ ...current, audienceId: event.target.value }))
              }
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="resend-from-email">From Email</Label>
              <Input
                id="resend-from-email"
                placeholder="updates@yourdomain.com"
                value={resendForm.fromEmail}
                onChange={(event) =>
                  setResendForm((current) => ({ ...current, fromEmail: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="resend-from-name">From Name</Label>
              <Input
                id="resend-from-name"
                placeholder="Repatch"
                value={resendForm.fromName}
                onChange={(event) =>
                  setResendForm((current) => ({ ...current, fromName: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="resend-reply-to">Reply-to Email</Label>
            <Input
              id="resend-reply-to"
              placeholder="support@yourdomain.com"
              value={resendForm.replyTo}
              onChange={(event) =>
                setResendForm((current) => ({ ...current, replyTo: event.target.value }))
              }
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Configure your Resend audience and sender defaults.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={activatingProvider === "resend" || savingProvider === "resend"}
            onClick={() => handleActivate("resend")}
          >
            {activatingProvider === "resend" ? "Activating..." : "Set Active"}
          </Button>
          <Button
            onClick={() => handleSave("resend")}
            disabled={savingProvider === "resend"}
          >
            {savingProvider === "resend" ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );

  const renderCustomerCard = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {EMAIL_PROVIDER_LABELS.customerio}
              {activeProvider === "customerio" && <Badge variant="outline">Active</Badge>}
            </CardTitle>
            <CardDescription>Send through the Customer.io transactional API.</CardDescription>
          </div>
          <Button variant="outline" asChild>
            <Link href={managementLinks.customerio} target="_blank" rel="noreferrer">
              Manage in Customer.io
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="customerio-api-key">App API Key</Label>
            <Input
              id="customerio-api-key"
              placeholder={secrets.customerIoApiKey ? "Configured" : "e4f8aa0..."}
              value={customerForm.appApiKey}
              onChange={(event) =>
                setCustomerForm((current) => ({ ...current, appApiKey: event.target.value }))
              }
              type="password"
            />
            {secrets.customerIoApiKey && (
              <p className="text-xs text-muted-foreground">
                A key is already stored. Enter a new key to replace it.
              </p>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="customerio-region">Region</Label>
              <select
                id="customerio-region"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={customerForm.region}
                onChange={(event) =>
                  setCustomerForm((current) => ({
                    ...current,
                    region: event.target.value === "eu" ? "eu" : "us",
                  }))
                }
              >
                <option value="us">United States</option>
                <option value="eu">European Union</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customerio-from-name">From Name</Label>
              <Input
                id="customerio-from-name"
                placeholder="Repatch"
                value={customerForm.fromName}
                onChange={(event) =>
                  setCustomerForm((current) => ({ ...current, fromName: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customerio-from-email">From Email</Label>
            <Input
              id="customerio-from-email"
              placeholder="updates@yourdomain.com"
              value={customerForm.fromEmail}
              onChange={(event) =>
                setCustomerForm((current) => ({ ...current, fromEmail: event.target.value }))
              }
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Customer.io sends email using the App API transactional endpoints.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={activatingProvider === "customerio" || savingProvider === "customerio"}
            onClick={() => handleActivate("customerio")}
          >
            {activatingProvider === "customerio" ? "Activating..." : "Set Active"}
          </Button>
          <Button
            onClick={() => handleSave("customerio")}
            disabled={savingProvider === "customerio"}
          >
            {savingProvider === "customerio" ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold">Email Providers</h1>
        <p className="text-muted-foreground text-sm">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Email Providers</h1>
        <p className="text-sm text-muted-foreground">
          Configure your newsletter delivery providers and choose which integration is active.
        </p>
        {successMessage && (
          <p className="text-sm text-green-600">{successMessage}</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="grid gap-6">
        {renderResendCard()}
        {renderCustomerCard()}
      </div>
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Provider status</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Resend configuration {resendConfigured ? "detected" : "not detected"}. Audience and sender values fall back to environment variables.
          </li>
          <li>
            Customer.io {customerConfigured ? "is available" : "is not yet configured"}. Use the App API key from your workspace settings.
          </li>
        </ul>
      </div>
    </div>
  );
}
