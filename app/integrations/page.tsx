"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
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
import {
  CodeBracketIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/16/solid";

type IntegrationItem = {
  id: "github" | "resend" | "customerio";
  name: string;
  description: string;
  href: string;
  configureHref: string;
  badge?: { label: string; variant?: "default" | "secondary" | "outline" };
  icon: React.ReactNode;
};

const INTEGRATIONS: IntegrationItem[] = [
  {
    id: "github",
    name: "GitHub",
    description:
      "Connect a repository to generate AI patch notes from commits, PRs, and releases.",
    href: "/integrations/github",
    configureHref: "/integrations/github/configure",
    badge: { label: "Source", variant: "outline" },
    icon: <CodeBracketIcon className="h-5 w-5" />,
  },
  {
    id: "resend",
    name: "Resend",
    description:
      "Send your patch notes newsletter via Resend with your preferred sender.",
    href: "/integrations/resend",
    configureHref: "/integrations/resend/configure",
    badge: { label: "Email", variant: "outline" },
    icon: <EnvelopeIcon className="h-5 w-5" />,
  },
  {
    id: "customerio",
    name: "Customer.io",
    description:
      "Deliver campaigns through Customer.io's transactional API with audience insights.",
    href: "/integrations/customerio",
    configureHref: "/integrations/customerio/configure",
    badge: { label: "Email", variant: "outline" },
    icon: <EnvelopeIcon className="h-5 w-5" />,
  },
];

export default function IntegrationsPage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INTEGRATIONS;
    return INTEGRATIONS.filter((i) =>
      [i.name, i.description, i.id].some((t) => t.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Sources & Integrations
        </h1>
        <p className="text-muted-foreground mt-1">
          Connect sources to generate patch notes and delivery integrations to
          send them.
        </p>
      </div>

      <div className="relative mb-8">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search for sources or integrations..."
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {item.icon}
                  <CardTitle className="text-base">{item.name}</CardTitle>
                </div>
                {item.badge && (
                  <Badge variant={item.badge.variant}>{item.badge.label}</Badge>
                )}
              </div>
              <CardDescription className="mt-2">
                {item.description}
              </CardDescription>
            </CardHeader>
            <CardContent />
            <CardFooter className="flex items-center justify-between">
              <Button asChild>
                <Link href={item.configureHref}>Connect</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={item.href} className="flex items-center gap-1">
                  Learn more
                  <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
