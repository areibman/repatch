"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UsersIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/16/solid";
import type { EmailProviderId } from "@/lib/email/types";

interface Subscriber {
  id: string;
  email: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface IntegrationResponse {
  provider: EmailProviderId;
  isActive: boolean;
  settings: Record<string, any>;
}

interface FeedbackState {
  type: "success" | "error";
  message: string;
}

const PROVIDER_METADATA: Record<EmailProviderId, { name: string; url: string; blurb: string }> = {
  resend: {
    name: "Resend",
    url: "https://resend.com",
    blurb: "Deliver product updates using Resend audiences and transactional APIs.",
  },
  customerio: {
    name: "Customer.io",
    url: "https://fly.customer.io",
    blurb: "Trigger campaigns through Customer.io's transactional messaging API.",
  },
};

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationResponse[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const [integrationsError, setIntegrationsError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<EmailProviderId>("resend");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [savingProvider, setSavingProvider] = useState<EmailProviderId | null>(null);

  const [resendSettings, setResendSettings] = useState({
    audienceId: "",
    fromEmail: "",
    fromName: "",
    apiKey: "",
  });
  const [resendHasApiKey, setResendHasApiKey] = useState(false);

  const [customerSettings, setCustomerSettings] = useState({
    region: "us",
    transactionalMessageId: "",
    fromEmail: "",
    fromName: "",
    trackSiteId: "",
    trackApiKey: "",
    appApiKey: "",
  });
  const [customerHasAppKey, setCustomerHasAppKey] = useState(false);
  const [customerHasTrackCreds, setCustomerHasTrackCreds] = useState(false);

  useEffect(() => {
    const fetchSubscribers = async () => {
      try {
        const response = await fetch("/api/subscribers");
        if (!response.ok) {
          throw new Error("Failed to fetch subscribers");
        }
        const data = await response.json();
        setSubscribers(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch subscribers"
        );
      } finally {
        setLoading(false);
      }
    };

    const fetchIntegrations = async () => {
      try {
        const response = await fetch("/api/email-integrations");
        if (!response.ok) {
          throw new Error("Failed to fetch email integrations");
        }
        const data: IntegrationResponse[] = await response.json();
        setIntegrations(data);

        const active = data.find((item) => item.isActive) ?? data[0];
        if (active) {
          setActiveProvider(active.provider);
        }

        const resend = data.find((item) => item.provider === "resend");
        if (resend) {
          setResendSettings((prev) => ({
            ...prev,
            audienceId: resend.settings.audienceId ?? "",
            fromEmail: resend.settings.fromEmail ?? "",
            fromName: resend.settings.fromName ?? "",
          }));
          setResendHasApiKey(Boolean(resend.settings.hasApiKey));
        }

        const customer = data.find((item) => item.provider === "customerio");
        if (customer) {
          setCustomerSettings((prev) => ({
            ...prev,
            region: (customer.settings.region ?? "us").toLowerCase(),
            transactionalMessageId:
              customer.settings.transactionalMessageId ?? "",
            fromEmail: customer.settings.fromEmail ?? "",
            fromName: customer.settings.fromName ?? "",
            trackSiteId: customer.settings.trackSiteId ?? "",
          }));
          setCustomerHasAppKey(Boolean(customer.settings.hasAppApiKey));
          setCustomerHasTrackCreds(Boolean(customer.settings.hasTrackCredentials));
        }
      } catch (err) {
        setIntegrationsError(
          err instanceof Error
            ? err.message
            : "Failed to load email integrations"
        );
      } finally {
        setIntegrationsLoading(false);
      }
    };

    fetchSubscribers();
    fetchIntegrations();
  }, []);

  const activeIntegration = useMemo(() => {
    return integrations.find((item) => item.provider === activeProvider) ?? null;
  }, [integrations, activeProvider]);

  const activeSubscribers = subscribers.filter((sub) => sub.active);
  const totalSubscribers = subscribers.length;

  const providerMeta = PROVIDER_METADATA[activeProvider];

  const handleFeedback = (type: FeedbackState["type"], message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const saveIntegration = async (
    provider: EmailProviderId,
    settings: Record<string, unknown>,
    markActive = false
  ) => {
    const payload = { ...settings };

    if ("apiKey" in payload && !payload.apiKey) {
      delete payload.apiKey;
    }
    if ("appApiKey" in payload && !payload.appApiKey) {
      delete payload.appApiKey;
    }
    if ("trackApiKey" in payload && !payload.trackApiKey) {
      delete payload.trackApiKey;
    }

    setSavingProvider(provider);
    try {
      const response = await fetch("/api/email-integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          settings: payload,
          isActive: markActive || provider === activeProvider,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || "Failed to update integration");
      }

      const updated: IntegrationResponse = await response.json();
      setIntegrations((prev) => {
        const existing = prev
          .filter((item) => item.provider !== provider)
          .map((item) =>
            markActive ? { ...item, isActive: false } : item
          );
        return [...existing, updated];
      });

      if (markActive) {
        setActiveProvider(provider);
      }

      if (provider === "resend") {
        setResendHasApiKey(Boolean(updated.settings.hasApiKey));
        setResendSettings((prev) => ({
          ...prev,
          audienceId:
            (updated.settings.audienceId as string) ?? prev.audienceId,
          fromEmail:
            (updated.settings.fromEmail as string) ?? prev.fromEmail,
          fromName:
            (updated.settings.fromName as string) ?? prev.fromName,
          apiKey: "",
        }));
      } else {
        setCustomerHasAppKey(Boolean(updated.settings.hasAppApiKey));
        setCustomerHasTrackCreds(
          Boolean(updated.settings.hasTrackCredentials)
        );
        setCustomerSettings((prev) => ({
          ...prev,
          region: (updated.settings.region as string) ?? prev.region,
          transactionalMessageId:
            (updated.settings.transactionalMessageId as string) ??
            prev.transactionalMessageId,
          fromEmail:
            (updated.settings.fromEmail as string) ?? prev.fromEmail,
          fromName:
            (updated.settings.fromName as string) ?? prev.fromName,
          trackSiteId:
            (updated.settings.trackSiteId as string) ?? prev.trackSiteId,
          trackApiKey: "",
          appApiKey: "",
        }));
      }

      handleFeedback("success", "Integration settings updated.");
    } catch (err) {
      handleFeedback(
        "error",
        err instanceof Error ? err.message : "Failed to update integration"
      );
    } finally {
      setSavingProvider(null);
    }
  };

  const manageUrl = providerMeta.url;

  const renderActiveDetails = () => {
    if (integrationsLoading) {
      return "Loading provider configuration...";
    }

    if (integrationsError) {
      return integrationsError;
    }

    if (!activeIntegration) {
      return "No email provider configured yet.";
    }

    const settings = activeIntegration.settings;

    if (activeProvider === "resend") {
      return (
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Audience ID:</span>{" "}
            {settings.audienceId || "Not configured"}
          </div>
          <div>
            <span className="font-medium">From Email:</span>{" "}
            {settings.fromEmail || "Not configured"}
          </div>
          <div>
            <span className="font-medium">From Name:</span>{" "}
            {settings.fromName || "Not configured"}
          </div>
          <div>
            <span className="font-medium">API Key:</span>{" "}
            {resendHasApiKey ? "Configured" : "Missing"}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium">Region:</span>{" "}
          {(settings.region ?? "us").toUpperCase()}
        </div>
        <div>
          <span className="font-medium">Transactional Message:</span>{" "}
          {settings.transactionalMessageId || "Not configured"}
        </div>
        <div>
          <span className="font-medium">From Email:</span>{" "}
          {settings.fromEmail || "Not configured"}
        </div>
        <div>
          <span className="font-medium">From Name:</span>{" "}
          {settings.fromName || "Not configured"}
        </div>
        <div>
          <span className="font-medium">Track Credentials:</span>{" "}
          {customerHasTrackCreds ? "Configured" : "Missing"}
        </div>
        <div>
          <span className="font-medium">App API Key:</span>{" "}
          {customerHasAppKey ? "Configured" : "Missing"}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between">
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
        <Button variant="outline" asChild>
          <Link
            href={manageUrl}
            target="_blank"
            className="flex items-center gap-1"
          >
            Manage in {providerMeta.name}
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {feedback && (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheckIcon className="h-5 w-5" />
            Delivery Provider
          </CardTitle>
          <CardDescription>
            Configure credentials and choose the system that sends your campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-4">
            <div>
              <p className="text-sm text-muted-foreground">Active provider</p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{providerMeta.name}</Badge>
                <span className="text-sm text-muted-foreground">
                  {providerMeta.blurb}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => saveIntegration(activeProvider, {}, true)}
            >
              Refresh Status
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">Resend</CardTitle>
                <CardDescription>
                  Store your Resend audience details and default sender information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="resend-audience">Audience ID</Label>
                  <Input
                    id="resend-audience"
                    value={resendSettings.audienceId}
                    onChange={(event) =>
                      setResendSettings((prev) => ({
                        ...prev,
                        audienceId: event.target.value,
                      }))
                    }
                    placeholder="aud_123..."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="resend-from-email">From email</Label>
                  <Input
                    id="resend-from-email"
                    value={resendSettings.fromEmail}
                    onChange={(event) =>
                      setResendSettings((prev) => ({
                        ...prev,
                        fromEmail: event.target.value,
                      }))
                    }
                    placeholder="newsletter@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="resend-from-name">From name</Label>
                  <Input
                    id="resend-from-name"
                    value={resendSettings.fromName}
                    onChange={(event) =>
                      setResendSettings((prev) => ({
                        ...prev,
                        fromName: event.target.value,
                      }))
                    }
                    placeholder="Patch Notes"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="resend-api-key">API key</Label>
                  <Input
                    id="resend-api-key"
                    type="password"
                    value={resendSettings.apiKey}
                    onChange={(event) =>
                      setResendSettings((prev) => ({
                        ...prev,
                        apiKey: event.target.value,
                      }))
                    }
                    placeholder={resendHasApiKey ? "Key stored" : "re_..."}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <Button
                  size="sm"
                  variant={activeProvider === "resend" ? "default" : "outline"}
                  onClick={() => saveIntegration("resend", resendSettings, true)}
                  disabled={savingProvider === "resend"}
                >
                  {activeProvider === "resend" ? "Active" : "Use Resend"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    saveIntegration("resend", {
                      ...resendSettings,
                      apiKey: resendSettings.apiKey || undefined,
                    })
                  }
                  disabled={savingProvider === "resend"}
                >
                  Save Settings
                </Button>
              </CardFooter>
            </Card>

            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">Customer.io</CardTitle>
                <CardDescription>
                  Connect Customer.io transactional messaging with optional track credentials.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="customer-region">Region</Label>
                  <Select
                    value={customerSettings.region}
                    onValueChange={(value) =>
                      setCustomerSettings((prev) => ({
                        ...prev,
                        region: value,
                      }))
                    }
                  >
                    <SelectTrigger id="customer-region">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us">US</SelectItem>
                      <SelectItem value="eu">EU</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customer-transactional">
                    Transactional message ID
                  </Label>
                  <Input
                    id="customer-transactional"
                    value={customerSettings.transactionalMessageId}
                    onChange={(event) =>
                      setCustomerSettings((prev) => ({
                        ...prev,
                        transactionalMessageId: event.target.value,
                      }))
                    }
                    placeholder="e.g. 3"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customer-from-email">From email</Label>
                  <Input
                    id="customer-from-email"
                    value={customerSettings.fromEmail}
                    onChange={(event) =>
                      setCustomerSettings((prev) => ({
                        ...prev,
                        fromEmail: event.target.value,
                      }))
                    }
                    placeholder="updates@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customer-from-name">From name</Label>
                  <Input
                    id="customer-from-name"
                    value={customerSettings.fromName}
                    onChange={(event) =>
                      setCustomerSettings((prev) => ({
                        ...prev,
                        fromName: event.target.value,
                      }))
                    }
                    placeholder="Product Team"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customer-app-key">App API key</Label>
                  <Input
                    id="customer-app-key"
                    type="password"
                    value={customerSettings.appApiKey}
                    onChange={(event) =>
                      setCustomerSettings((prev) => ({
                        ...prev,
                        appApiKey: event.target.value,
                      }))
                    }
                    placeholder={customerHasAppKey ? "Key stored" : "app_..."}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customer-site">Track site ID</Label>
                  <Input
                    id="customer-site"
                    value={customerSettings.trackSiteId}
                    onChange={(event) =>
                      setCustomerSettings((prev) => ({
                        ...prev,
                        trackSiteId: event.target.value,
                      }))
                    }
                    placeholder="site_123"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customer-track-key">Track API key</Label>
                  <Input
                    id="customer-track-key"
                    type="password"
                    value={customerSettings.trackApiKey}
                    onChange={(event) =>
                      setCustomerSettings((prev) => ({
                        ...prev,
                        trackApiKey: event.target.value,
                      }))
                    }
                    placeholder={
                      customerHasTrackCreds ? "Key stored" : "track_..."
                    }
                  />
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <Button
                  size="sm"
                  variant={
                    activeProvider === "customerio" ? "default" : "outline"
                  }
                  onClick={() =>
                    saveIntegration("customerio", customerSettings, true)
                  }
                  disabled={savingProvider === "customerio"}
                >
                  {activeProvider === "customerio"
                    ? "Active"
                    : "Use Customer.io"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    saveIntegration("customerio", {
                      ...customerSettings,
                      appApiKey: customerSettings.appApiKey || undefined,
                      trackApiKey: customerSettings.trackApiKey || undefined,
                    })
                  }
                  disabled={savingProvider === "customerio"}
                >
                  Save Settings
                </Button>
              </CardFooter>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Audience Configuration
          </CardTitle>
          <CardDescription>
            {`Your ${providerMeta.name} defaults for patch note delivery.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderActiveDetails()}
        </CardContent>
        <CardFooter className="justify-end">
          <Button variant="outline" asChild>
            <Link
              href={manageUrl}
              target="_blank"
              className="flex items-center gap-1"
            >
              Manage in {providerMeta.name}
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardFooter>
      </Card>

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
                  className="flex items-center justify-between rounded-lg bg-muted p-3"
                >
                  <div>
                    <div className="font-medium">{subscriber.email}</div>
                    <div className="text-sm text-muted-foreground">
                      Added {" "}
                      {new Date(subscriber.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
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
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Subscriber Summary</CardTitle>
          <CardDescription>
            Overview of total, active, and unsubscribed contacts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Loading subscribers...
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <ExclamationTriangleIcon className="h-4 w-4" />
              {error}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-muted p-4">
                <div className="text-2xl font-bold">{totalSubscribers}</div>
                <div className="text-sm text-muted-foreground">
                  Total Subscribers
                </div>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <div className="text-2xl font-bold text-green-600">
                  {activeSubscribers.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Active Subscribers
                </div>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <div className="text-2xl font-bold text-orange-600">
                  {totalSubscribers - activeSubscribers.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Unsubscribed
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button variant="outline" asChild>
            <Link
              href={manageUrl}
              target="_blank"
              className="flex items-center gap-1"
            >
              Manage in {providerMeta.name}
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
