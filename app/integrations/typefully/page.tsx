"use client";

import Link from "next/link";
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
  ChatBubbleBottomCenterTextIcon,
} from "@heroicons/react/16/solid";

export default function TypefullyIntegrationPage() {
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
          <ChatBubbleBottomCenterTextIcon className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Typefully</h1>
            <p className="text-muted-foreground">
              Turn your patch notes into threaded social posts with one click.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/integrations/typefully/configure">Connect</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link
              href="https://support.typefully.com/en/articles/8718287-typefully-api"
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
            Queue polished Twitter threads enriched with Remotion video clips and
            release highlights.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
            <li>Store Typefully credentials securely inside Supabase</li>
            <li>Attach rendered patch note videos to the first tweet</li>
            <li>Track queued jobs and metadata for auditability</li>
          </ul>
        </CardContent>
        <CardFooter className="justify-end">
          <Button asChild>
            <Link href="/integrations/typefully/configure">Get set up</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
