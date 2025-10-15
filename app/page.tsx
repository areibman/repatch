"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { PatchNote } from "@/types/patch-note";
import { CreatePostDialog } from "@/components/create-post-dialog";
import {
  PlusIcon,
  CodeBracketIcon,
  CalendarIcon,
  UsersIcon,
} from "@heroicons/react/16/solid";

export default function Home() {
  const [patchNotes, setPatchNotes] = useState<PatchNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatchNotes = async () => {
      try {
        const response = await fetch("/api/patch-notes");
        if (!response.ok) {
          throw new Error("Failed to fetch patch notes");
        }
        const data = await response.json();

        // Transform database format to UI format
        const transformedData = data.map(
          (note: {
            id: string;
            repo_name: string;
            repo_url: string;
            time_period: "1day" | "1week" | "1month";
            generated_at: string;
            title: string;
            content: string;
            changes: { added: number; modified: number; removed: number };
            contributors: string[];
            video_url?: string | null;
            github_publish_status?: "idle" | "publishing" | "published" | "failed";
            github_publish_target?: "release" | "discussion" | null;
            github_release_id?: string | null;
            github_release_url?: string | null;
            github_discussion_id?: string | null;
            github_discussion_url?: string | null;
            github_publish_attempted_at?: string | null;
            github_publish_completed_at?: string | null;
            github_publish_error?: string | null;
          }) => ({
            id: note.id,
            repoName: note.repo_name,
            repoUrl: note.repo_url,
            timePeriod: note.time_period,
            generatedAt: new Date(note.generated_at),
            title: note.title,
            content: note.content,
            changes: note.changes,
            contributors: note.contributors,
            videoUrl: note.video_url,
            githubPublishStatus: note.github_publish_status ?? "idle",
            githubPublishTarget: note.github_publish_target ?? null,
            githubReleaseId: note.github_release_id ?? null,
            githubReleaseUrl: note.github_release_url ?? null,
            githubDiscussionId: note.github_discussion_id ?? null,
            githubDiscussionUrl: note.github_discussion_url ?? null,
            githubPublishAttemptedAt: note.github_publish_attempted_at
              ? new Date(note.github_publish_attempted_at)
              : null,
            githubPublishCompletedAt: note.github_publish_completed_at
              ? new Date(note.github_publish_completed_at)
              : null,
            githubPublishError: note.github_publish_error ?? null,
          })
        );

        setPatchNotes(transformedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatchNotes();
  }, []);

  const getTimePeriodLabel = (period: string) => {
    switch (period) {
      case "1day":
        return "Daily";
      case "1week":
        return "Weekly";
      case "1month":
        return "Monthly";
      default:
        return period;
    }
  };

  const getTimePeriodColor = (period: string) => {
    switch (period) {
      case "1day":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
      case "1week":
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
      case "1month":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <p className="text-muted-foreground">Loading patch notes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-destructive mb-4">Error: {error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Repatch</h1>
            <p className="text-muted-foreground text-sm mt-1">
              AI-generated patch notes from your repositories
            </p>
          </div>
          <CreatePostDialog />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{patchNotes.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Repositories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {new Set(patchNotes.map((p) => p.repoName)).size}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {
                  patchNotes.filter((p) => {
                    const date = new Date(p.generatedAt);
                    const now = new Date();
                    return (
                      date.getMonth() === now.getMonth() &&
                      date.getFullYear() === now.getFullYear()
                    );
                  }).length
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Patch Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patchNotes.map((note) => (
            <Link key={note.id} href={`/blog/${note.id}`}>
              <Card className="h-full hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer group">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge
                      variant="outline"
                      className={getTimePeriodColor(note.timePeriod)}
                    >
                      {getTimePeriodLabel(note.timePeriod)}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarIcon className="h-3 w-3" />
                      {new Date(note.generatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>

                  <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                    {note.title}
                  </CardTitle>

                  <CardDescription className="flex items-center gap-1 mt-2">
                    <CodeBracketIcon className="h-3 w-3" />
                    {note.repoName}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {note.content}
                  </p>

                  {/* Change Stats */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-green-500/10 rounded-md p-2 text-center">
                      <div className="font-semibold text-green-700 dark:text-green-400">
                        +{note.changes.added.toLocaleString()}
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        added
                      </div>
                    </div>
                    <div className="bg-blue-500/10 rounded-md p-2 text-center">
                      <div className="font-semibold text-blue-700 dark:text-blue-400">
                        ~{note.changes.modified.toLocaleString()}
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        modified
                      </div>
                    </div>
                    <div className="bg-red-500/10 rounded-md p-2 text-center">
                      <div className="font-semibold text-red-700 dark:text-red-400">
                        -{note.changes.removed.toLocaleString()}
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        removed
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <UsersIcon className="h-3 w-3" />
                    {note.contributors.length} contributor
                    {note.contributors.length !== 1 ? "s" : ""}
                  </div>
                  <div className="text-primary font-medium group-hover:underline">
                    Read more →
                  </div>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>

        {/* Empty State (shown when no posts) */}
        {patchNotes.length === 0 && !isLoading && (
          <Card className="text-center py-12">
            <CardContent>
              <CodeBracketIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No patch notes yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first patch note to get started
              </p>
              <CreatePostDialog />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
