"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  UsersIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
  PlusIcon,
} from "@heroicons/react/16/solid";

interface Subscriber {
  id: string;
  email: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface ProviderField {
  key: string;
  label: string;
  type: "text" | "password" | "email" | "select";
  description?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  value: string;
  maskedValue?: string | null;
}

interface ProviderSummary {
  id: "resend" | "customerio";
  name: string;
  isActive: boolean;
  configured: boolean;
  source: "database" | "environment" | "missing";
  lastUpdated: string | null;
  fields: ProviderField[];
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providerInfo, setProviderInfo] = useState<ProviderSummary | null>(
    null
  );
  const [providerError, setProviderError] = useState<string | null>(null);

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

    fetchSubscribers();
  }, []);

  useEffect(() => {
    const fetchProvider = async () => {
      try {
        setProviderError(null);
        const response = await fetch("/api/email/providers");
        if (!response.ok) {
          const err = await response.json().catch(() => null);
          throw new Error(err?.error || "Failed to load provider settings");
        }

        const data = await response.json();
        const providers = (data.providers ?? []) as ProviderSummary[];
        const active = providers.find(
          provider => provider.id === data.activeProvider
        );
        setProviderInfo(active ?? providers[0] ?? null);
      } catch (err) {
        console.error("Error loading email provider:", err);
        setProviderError(
          err instanceof Error
            ? err.message
            : "Failed to load email provider"
        );
      }
    };

    fetchProvider();
  }, []);

  const providerName = providerInfo?.name ?? "Resend";
  const providerConsoleUrl =
    providerInfo?.id === "customerio"
      ? "https://fly.customer.io"
      : "https://resend.com";
  const providerSource = providerInfo?.source ?? "environment";
  const providerConfigured = providerInfo?.configured ?? false;

  const providerFields = providerInfo?.fields ?? [];

  const getFieldDisplayValue = (field: ProviderField) => {
    if (field.maskedValue) {
      return field.maskedValue;
    }

    if (field.value) {
      if (field.type === "select" && field.options) {
        const option = field.options.find(option => option.value === field.value);
        return option?.label ?? field.value;
      }

      return field.value;
    }

    return "Not set";
  };

  const filteredProviderFields = providerFields.filter(field => {
    if (field.type === "password") {
      return Boolean(field.maskedValue);
    }
    return Boolean(field.value);
  });

  const activeSubscribers = subscribers.filter((sub) => sub.active);
  const totalSubscribers = subscribers.length;

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
          <Button variant="outline" asChild>
            <Link
              href={providerConsoleUrl}
              target="_blank"
              className="flex items-center gap-1"
            >
              Manage in {providerName}{" "}
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Audience Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Audience Configuration
          </CardTitle>
          <CardDescription>
            {`Your ${providerName} configuration for patch notes subscribers.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div className="rounded-md border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Provider Status</div>
                  <p className="text-xs text-muted-foreground">
                    {providerConfigured
                      ? providerSource === "database"
                        ? "Credentials stored securely in Supabase."
                        : "Credentials loaded from environment variables."
                      : "Add credentials in Settings → Email to start sending."}
                  </p>
                  {providerError && (
                    <p className="mt-2 text-xs text-destructive">
                      {providerError}
                    </p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    providerConfigured
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {providerConfigured ? "Configured" : "Needs setup"}
                </span>
              </div>
            </div>

            <div className="grid gap-3">
              {filteredProviderFields.length > 0 ? (
                filteredProviderFields.map(field => (
                  <div
                    key={field.key}
                    className="rounded-md border p-3"
                  >
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      {field.label}
                    </div>
                    <div className="mt-1 font-mono text-sm">
                      {getFieldDisplayValue(field)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No provider details available yet. Configure credentials in
                  Settings → Email.
                </div>
              )}
            </div>

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
          <Button variant="outline" asChild>
            <Link
              href={providerConsoleUrl}
              target="_blank"
              className="flex items-center gap-1"
            >
              Manage in {providerName}{" "}
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            </Link>
          </Button>
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
                      {new Date(subscriber.created_at).toLocaleDateString()}
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
            <Button variant="outline" asChild>
              <Link
                href={providerConsoleUrl}
                target="_blank"
                className="flex items-center gap-1"
              >
                View All in {providerName}{" "}
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </Link>
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
              Your audience is empty. Add subscribers through {providerName} or
              signup forms.
            </p>
            <Button variant="outline" asChild>
              <Link
                href={providerConsoleUrl}
                target="_blank"
                className="flex items-center gap-1"
              >
                <PlusIcon className="h-4 w-4" />
                Add Subscribers in {providerName}
              </Link>
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
