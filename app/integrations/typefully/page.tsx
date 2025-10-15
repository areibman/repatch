"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function TypefullyIntegrationPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Typefully</h1>
        <p className="text-muted-foreground mt-1">
          Queue your patch notes as a Twitter/X thread via Typefully, optionally attaching the generated video.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Typefully</CardTitle>
          <CardDescription>
            Manage your Typefully connection and learn how threads are queued.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            This integration mirrors the Resend UX. Configure your API key first, then use the action on each patch note page.
          </p>
        </CardContent>
        <CardFooter className="justify-between">
          <Button variant="ghost" asChild>
            <Link href="/integrations">Back</Link>
          </Button>
          <Button asChild>
            <Link href="/integrations/typefully/configure">Connect</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
