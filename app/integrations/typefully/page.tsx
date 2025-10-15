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
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
          </svg>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Typefully</h1>
            <p className="text-muted-foreground">
              Queue your patch notes as threaded Twitter posts with optional video uploads.
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
            Repatch uses your Typefully API key to queue threaded Twitter posts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
            <li>Automatically format patch notes as Twitter threads</li>
            <li>Optional video upload support for rich media posts</li>
            <li>Queue posts directly from each patch note page</li>
            <li>Track job status and thread IDs</li>
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
