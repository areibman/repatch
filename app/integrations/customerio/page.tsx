"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  EnvelopeIcon,
} from "@heroicons/react/16/solid";

type ProviderState = {
  fromEmail?: string;
  isActive?: boolean;
  configured?: boolean;
  managedByEnv?: boolean;
};

export default function CustomerIOIntegrationPage() {
  const [provider, setProvider] = useState<ProviderState | null>(null);

  useEffect(() => {
    const loadProvider = async () => {
      try {
        const response = await fetch("/api/email/providers/customerio");
        if (!response.ok) {
          throw new Error("Failed to load provider");
        }
        const data = await response.json();
        setProvider(data);
      } catch (error) {
        console.error("Failed to load provider", error);
      }
    };

    loadProvider();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/integrations" className="flex items-center gap-1">
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <EnvelopeIcon className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Customer.io
            </h1>
            <p className="text-muted-foreground">
              Deliver transactional newsletters via Customer.io campaigns or
              journeys.
            </p>
            {provider && (
              <div className="mt-2 text-xs text-muted-foreground">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                    provider.isActive
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {provider.isActive ? "Active provider" : "Not active"}
                  {provider.managedByEnv && " • env"}
                </span>
                {provider.fromEmail && (
                  <div className="mt-2 font-mono text-xs text-muted-foreground/80">
                    {provider.fromEmail}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/integrations/customerio/configure">Connect</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link
              href="https://customer.io/docs/transactional-api/"
              target="_blank"
              className="flex items-center gap-1"
            >
              Docs <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What you get</CardTitle>
          <CardDescription>
            Repatch uses your Customer.io transactional message and credentials
            to deliver newsletters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
            <li>Use transactional messages for direct campaign sends</li>
            <li>Control suppression states through Customer.io</li>
            <li>Supports US and EU regions</li>
          </ul>
        </CardContent>
        <CardFooter className="justify-end">
          <Button asChild>
            <Link href="/integrations/customerio/configure">Get set up</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
