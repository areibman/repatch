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
import { Badge } from "@/components/ui/badge";
import { useEmailIntegrations } from "@/hooks/use-email-integrations";

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
  const {
    providers,
    activeProvider,
    loading: providersLoading,
    error: providersError,
  } = useEmailIntegrations();

  const activeIntegration = useMemo(() => {
    if (activeProvider) {
      return providers.find((provider) => provider.id === activeProvider);
    }
    return providers[0];
  }, [providers, activeProvider]);

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
              href={activeIntegration?.manageUrl ?? "https://resend.com"}
              target="_blank"
              className="flex items-center gap-1"
            >
              Manage in {activeIntegration?.name ?? "your provider"}{" "}
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
            {activeIntegration
              ? `Your ${activeIntegration.name} configuration for patch note subscribers`
              : "Connect an email provider to manage subscribers"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span>Provider status:</span>
              {providersLoading ? (
                <span className="text-muted-foreground">Loading…</span>
              ) : providersError ? (
                <span className="text-destructive">{providersError}</span>
              ) : activeIntegration ? (
                <Badge variant={activeIntegration.isActive ? "default" : "outline"}>
                  {activeIntegration.isActive ? "Active" : "Inactive"}
                </Badge>
              ) : (
                <Badge variant="outline">Not configured</Badge>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Provider
              </label>
              <div className="mt-1 p-3 bg-muted rounded-md text-sm">
                {activeIntegration?.name ?? "Not connected"}
              </div>
            </div>
            {activeIntegration?.audienceId && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Audience ID
                </label>
                <div className="mt-1 p-3 bg-muted rounded-md font-mono text-sm">
                  {activeIntegration.audienceId}
                </div>
              </div>
            )}
            {activeIntegration?.defaultSender && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Default sender
                </label>
                <div className="mt-1 p-3 bg-muted rounded-md text-sm">
                  {activeIntegration.defaultSender}
                </div>
              </div>
            )}
            {activeIntegration?.source === "env" && (
              <p className="text-xs text-muted-foreground">
                Provider credentials are currently sourced from environment
                variables. Save them in Supabase to edit from the dashboard.
              </p>
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
          <Button variant="outline" asChild>
            <Link
              href={activeIntegration?.manageUrl ?? "https://resend.com"}
              target="_blank"
              className="flex items-center gap-1"
            >
              Manage in {activeIntegration?.name ?? "your provider"}{" "}
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
                href={activeIntegration?.manageUrl ?? "https://resend.com"}
                target="_blank"
                className="flex items-center gap-1"
              >
                View All in {activeIntegration?.name ?? "your provider"}{" "}
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
              {activeIntegration?.name ?? "your provider"} or your signup
              forms.
            </p>
            <Button variant="outline" asChild>
              <Link
                href={activeIntegration?.manageUrl ?? "https://resend.com"}
                target="_blank"
                className="flex items-center gap-1"
              >
                <PlusIcon className="h-4 w-4" />
                Add Subscribers in {activeIntegration?.name ?? "your provider"}
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
