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
  id: "github" | "resend" | "typefully";
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
    id: "typefully",
    name: "Typefully",
    description:
      "Queue patch notes as threaded Twitter posts with optional video uploads.",
    href: "/integrations/typefully",
    configureHref: "/integrations/typefully/configure",
    badge: { label: "Social", variant: "outline" },
    icon: (
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
      </svg>
    ),
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
