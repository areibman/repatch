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
import {
  UsersIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
  PlusIcon,
} from "@heroicons/react/16/solid";
import { EmailProviderSummary } from "@/lib/email/types";

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
  const [provider, setProvider] = useState<EmailProviderSummary | null>(null);
  const [source, setSource] = useState<"database" | "provider" | "unknown">(
    "database"
  );

  useEffect(() => {
    const fetchSubscribers = async () => {
      try {
        const response = await fetch("/api/subscribers");
        if (!response.ok) {
          throw new Error("Failed to fetch subscribers");
        }
        const data = await response.json();
        setSubscribers(data.subscribers || []);
        setProvider(data.provider || null);
        setSource(data.source || "database");
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

  const activeSubscribers = subscribers.filter((sub) => sub.active);
  const totalSubscribers = subscribers.length;
  const providerDashboardUrl = useMemo(() => {
    if (provider?.id === "resend") {
      return "https://resend.com";
    }
    if (provider?.id === "customerio") {
      return "https://customer.io";
    }
    return null;
  }, [provider?.id]);

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
              {provider?.label ? ` with ${provider.label}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {providerDashboardUrl ? (
            <Button variant="outline" asChild>
              <Link
                href={providerDashboardUrl}
                target="_blank"
                className="flex items-center gap-1"
              >
                Manage in {provider?.label ?? "Provider"}{" "}
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/integrations">Configure Email</Link>
            </Button>
          )}
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
            {provider?.label
              ? `Your ${provider.label} configuration for patch notes subscribers.`
              : "Connect an email provider to deliver newsletters."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {provider?.additional?.audienceId && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Audience ID
                </label>
                <div className="mt-1 p-3 bg-muted rounded-md font-mono text-sm">
                  {provider.additional.audienceId as string}
                </div>
              </div>
            )}
            {provider?.fromEmail && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Sender Email
                </label>
                <div className="mt-1 p-3 bg-muted rounded-md text-sm">
                  {provider.fromEmail}
                </div>
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
            {source === "provider" && !loading && !error && (
              <p className="text-xs text-muted-foreground">
                Displaying subscribers pulled directly from {provider?.label}.
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          {providerDashboardUrl ? (
            <Button variant="outline" asChild>
              <Link
                href={providerDashboardUrl}
                target="_blank"
                className="flex items-center gap-1"
              >
                Manage in {provider?.label ?? "Provider"}{" "}
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/integrations">Configure Email</Link>
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
            {providerDashboardUrl ? (
              <Button variant="outline" asChild>
                <Link
                  href={providerDashboardUrl}
                  target="_blank"
                  className="flex items-center gap-1"
                >
                  View All in {provider?.label ?? "Provider"}{" "}
                  <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link href="/integrations">Configure Email</Link>
              </Button>
            )}
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
              {provider?.label ? ` ${provider.label}` : " your signup forms"}.
            </p>
            {providerDashboardUrl ? (
              <Button variant="outline" asChild>
                <Link
                  href={providerDashboardUrl}
                  target="_blank"
                  className="flex items-center gap-1"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Subscribers in {provider?.label}
                </Link>
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link href="/integrations">Configure Email</Link>
              </Button>
            )}
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
