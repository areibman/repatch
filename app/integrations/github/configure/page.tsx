"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
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
import { ArrowLeftIcon } from "@heroicons/react/16/solid";
import { saveGitHubConfigAction } from "@/app/integrations/github/actions";

export default function GitHubConfigurePage() {
  const [state, formAction] = useActionState(saveGitHubConfigAction, {
    ok: false,
  });
  const [repoUrl, setRepoUrl] = useState("");
  const [token, setToken] = useState("");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/integrations/github" className="flex items-center gap-1">
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Connect GitHub</CardTitle>
          <CardDescription>
            Provide a repository URL and a token with read access to code and
            PRs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Repository URL</label>
            <Input
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Access Token</label>
            <Input
              type="password"
              placeholder="ghp_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your token is stored securely and never shared.
            </p>
          </div>
          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          {state.ok && state.id && (
            <p
              className="text-sm text-emerald-600"
              role="status"
              aria-live="polite"
            >
              GitHub connection saved successfully.
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href="/integrations">Cancel</Link>
          </Button>
          <form action={formAction} className="inline-flex gap-2 items-center">
            <input type="hidden" name="repoUrl" value={repoUrl} />
            <input type="hidden" name="accessToken" value={token} />
            <Button type="submit">Save</Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
