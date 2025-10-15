"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

type ActiveProvider = {
  provider: "resend" | "customerio";
  fromEmail: string;
  manageUrl: string;
  isFallback?: boolean;
};

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<ActiveProvider | null>(null);
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
        const response = await fetch("/api/email/providers");
        if (!response.ok) {
          throw new Error("Failed to load provider");
        }
        const data = await response.json();
        if (data?.active?.provider) {
          setProvider({
            provider: data.active.provider,
            fromEmail: data.active.fromEmail,
            manageUrl: data.active.manageUrl,
            isFallback: data.active.isFallback,
          });
        }
      } catch (err) {
        console.error(err);
        setProviderError(
          err instanceof Error ? err.message : "Failed to load provider"
        );
      }
    };

    fetchProvider();
  }, []);

  const activeSubscribers = subscribers.filter((sub) => sub.active);
  const totalSubscribers = subscribers.length;

  const providerLabel = useMemo(() => {
    if (!provider) return "your email provider";
    return provider.provider === "customerio" ? "Customer.io" : "Resend";
  }, [provider]);

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
          {provider?.manageUrl && (
            <Button variant="outline" asChild>
              <Link
                href={provider.manageUrl}
                target="_blank"
                className="flex items-center gap-1"
              >
                Manage in {providerLabel}
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Provider Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Email delivery
          </CardTitle>
          <CardDescription>
            {provider
              ? `${providerLabel} will deliver your campaigns`
              : "Configure an email provider to send newsletters"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {provider && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs uppercase text-muted-foreground">
                    Provider
                  </div>
                  <div className="text-sm font-medium">
                    {providerLabel}
                    {provider.isFallback && " (env)"}
                  </div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs uppercase text-muted-foreground">
                    From email
                  </div>
                  <div className="text-sm font-medium">
                    {provider.fromEmail || "Not set"}
                  </div>
                </div>
              </div>
            )}

            {providerError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <ExclamationTriangleIcon className="h-4 w-4" />
                {providerError}
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
        {provider?.manageUrl && (
          <CardFooter className="justify-end">
            <Button variant="outline" asChild>
              <Link
                href={provider.manageUrl}
                target="_blank"
                className="flex items-center gap-1"
              >
                Manage in {providerLabel}
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardFooter>
        )}
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
            {provider?.manageUrl && (
              <Button variant="outline" asChild>
                <Link
                  href={provider.manageUrl}
                  target="_blank"
                  className="flex items-center gap-1"
                >
                  View all in {providerLabel}
                  <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                </Link>
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
              Your audience is empty. Add subscribers through {providerLabel} or
              signup forms.
            </p>
            {provider?.manageUrl && (
              <Button variant="outline" asChild>
                <Link
                  href={provider.manageUrl}
                  target="_blank"
                  className="flex items-center gap-1"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add subscribers in {providerLabel}
                </Link>
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
