"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  EnvelopeIcon,
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/16/solid";
import { useEmailIntegrations } from "@/hooks/use-email-integrations";

export default function CustomerIoIntegrationPage() {
  const { providers, loading, error } = useEmailIntegrations();
  const customerio = providers.find((provider) => provider.id === "customerio");

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
            <h1 className="text-2xl font-semibold tracking-tight">Customer.io</h1>
            <p className="text-muted-foreground">
              Trigger transactional patch note emails via Customer.io.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/integrations/customerio/configure">Connect</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link
              href="https://customer.io/docs/api/"
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
            Repatch uses the Customer.io transactional API and your track key to
            deliver newsletters while keeping audiences in sync.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span>Status:</span>
              {loading ? (
                <span className="text-muted-foreground">Loading…</span>
              ) : error ? (
                <span className="text-destructive">{error}</span>
              ) : customerio ? (
                <Badge variant={customerio.isActive ? "default" : "outline"}>
                  {customerio.isActive ? "Active" : "Inactive"}
                </Badge>
              ) : (
                <Badge variant="outline">Not configured</Badge>
              )}
            </div>
            {customerio?.defaultSender && (
              <div>
                <span className="text-muted-foreground">Default sender:</span>{" "}
                <span className="font-medium">{customerio.defaultSender}</span>
              </div>
            )}
            {customerio?.source === "env" && (
              <div className="text-muted-foreground">
                Credentials loaded from environment variables. Save them in
                Supabase to manage from this dashboard.
              </div>
            )}
          </div>
          <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
            <li>Transactional API delivery with inline HTML support</li>
            <li>Subscriber management through Customer.io audiences</li>
            <li>Switchable provider support within Repatch</li>
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
