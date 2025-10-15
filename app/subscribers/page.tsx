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
import { SanitizedIntegrationConfig } from "@/lib/email/types";

interface Subscriber {
  id: string;
  email: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providerInfo, setProviderInfo] = useState<
    SanitizedIntegrationConfig | null
  >(null);
  const [providerLoading, setProviderLoading] = useState(true);
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
    let cancelled = false;

    async function loadProvider() {
      setProviderLoading(true);
      setProviderError(null);
      try {
        const response = await fetch("/api/email-integrations");
        const data: {
          activeProvider: SanitizedIntegrationConfig | null;
          error?: string;
        } = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load email provider");
        }

        if (cancelled) return;
        setProviderInfo(data.activeProvider);
      } catch (error) {
        if (cancelled) return;
        setProviderInfo(null);
        setProviderError(
          error instanceof Error
            ? error.message
            : "Unable to load email provider"
        );
      } finally {
        if (!cancelled) {
          setProviderLoading(false);
        }
      }
    }

    loadProvider();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeSubscribers = subscribers.filter((sub) => sub.active);
  const totalSubscribers = subscribers.length;
  const providerConfig = providerInfo?.config as
    | Record<string, string | undefined>
    | undefined;
  const providerAudienceId = providerConfig?.audienceId;
  const providerMessageId = providerConfig?.transactionalMessageId;
  const providerRegion = providerConfig?.region;
  const providerDashboard = providerInfo?.dashboardUrl ?? "#";
  const providerLabel = providerInfo?.label ?? "Email provider";

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
          <Button
            variant="outline"
            asChild
            disabled={providerLoading || !providerInfo?.dashboardUrl}
          >
            <Link
              href={providerDashboard}
              target={providerInfo?.dashboardUrl ? "_blank" : undefined}
              className="flex items-center gap-1"
            >
              Manage in {providerInfo?.label ?? "provider"}{" "}
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
            Email Delivery
          </CardTitle>
          <CardDescription>
            {providerLoading
              ? "Loading email provider details..."
              : providerInfo
              ? `Powered by ${providerInfo.label}`
              : "Connect an email provider to enable sending"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Provider
                </label>
                <div className="mt-1 rounded-md bg-muted px-3 py-2 text-sm">
                  {providerLoading
                    ? "Loading..."
                    : providerInfo
                    ? providerLabel
                    : "Not connected"}
                </div>
                {providerInfo && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {providerInfo.isActive ? "Active provider" : "Configured"}
                    {providerInfo.source === "environment" && " • from environment"}
                  </p>
                )}
                {providerError && !providerInfo && !providerLoading && (
                  <p className="mt-1 text-xs text-destructive">{providerError}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Defaults
                </label>
                <div className="mt-1 rounded-md bg-muted px-3 py-2 text-sm">
                  {providerInfo?.fromEmail ?? "Sender not configured"}
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {providerAudienceId && (
                    <div>
                      Audience ID:{" "}
                      <span className="font-mono text-foreground break-all">
                        {providerAudienceId}
                      </span>
                    </div>
                  )}
                  {providerMessageId && (
                    <div>
                      Message ID:{" "}
                      <span className="font-mono text-foreground break-all">
                        {providerMessageId}
                      </span>
                    </div>
                  )}
                  {providerRegion && (
                    <div>
                      Region:{" "}
                      <span className="text-foreground uppercase">
                        {providerRegion}
                      </span>
                    </div>
                  )}
                </div>
              </div>
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
          <Button
            variant="outline"
            asChild
            disabled={providerLoading || !providerInfo?.dashboardUrl}
          >
            <Link
              href={providerDashboard}
              target={providerInfo?.dashboardUrl ? "_blank" : undefined}
              className="flex items-center gap-1"
            >
              Manage in {providerInfo?.label ?? "provider"}{" "}
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
            <Button
              variant="outline"
              asChild
              disabled={providerLoading || !providerInfo?.dashboardUrl}
            >
              <Link
                href={providerDashboard}
                target={providerInfo?.dashboardUrl ? "_blank" : undefined}
                className="flex items-center gap-1"
              >
                View in {providerInfo?.label ?? "provider"}{" "}
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
              Your audience is empty. Add subscribers through
              {" "}
              {providerInfo?.label ?? "your email provider"} or your signup
              forms.
            </p>
            <Button
              variant="outline"
              asChild
              disabled={providerLoading || !providerInfo?.dashboardUrl}
            >
              <Link
                href={providerDashboard}
                target={providerInfo?.dashboardUrl ? "_blank" : undefined}
                className="flex items-center gap-1"
              >
                <PlusIcon className="h-4 w-4" />
                Add Subscribers in {providerInfo?.label ?? "provider"}
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
