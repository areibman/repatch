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
  CodeBracketIcon,
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/16/solid";

export default function GitHubIntegrationPage() {
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
          <CodeBracketIcon className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">GitHub</h1>
            <p className="text-muted-foreground">
              Connect a repository to generate AI patch notes from commits and
              PRs.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/integrations/github/configure">Connect</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link
              href="https://docs.github.com/"
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
            Repatch reads commit messages, PR titles and merges to summarize
            changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
            <li>Daily, weekly or monthly summaries from repository history</li>
            <li>
              Contributor counts and change stats (added/modified/removed)
            </li>
            <li>Link back to PRs and commits in your blog posts</li>
          </ul>
        </CardContent>
        <CardFooter className="justify-end">
          <Button asChild>
            <Link href="/integrations/github/configure">Get set up</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
