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
import { CommitSummary, PatchNote } from "@/types/patch-note";
import { formatFilterSummary } from "@/lib/filter-utils";
import { cn } from "@/lib/utils";
import { CreatePostDialog } from "@/components/create-post-dialog";
import {
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
            time_period: "1day" | "1week" | "1month" | "custom" | "release";
            generated_at: string;
            title: string;
            content: string;
            changes: { added: number; modified: number; removed: number };
            contributors: string[];
            video_url?: string | null;
            filter_metadata?: any;
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
            repoBranch: note.repo_branch,
            aiSummaries: note.ai_summaries as CommitSummary[] | null,
            aiOverallSummary: note.ai_overall_summary,
            aiTemplateId: note.ai_template_id,
            filterMetadata: note.filter_metadata ?? null,
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

  const getFilterLabel = (note: PatchNote) =>
    formatFilterSummary(note.filterMetadata, note.timePeriod);

  const getTimePeriodColor = (period: string) => {
    switch (period) {
      case "1day":
        return "text-blue-600 dark:text-blue-300";
      case "1week":
        return "text-emerald-600 dark:text-emerald-300";
      case "1month":
        return "text-violet-600 dark:text-violet-300";
      case "custom":
        return "text-amber-600 dark:text-amber-300";
      case "release":
        return "text-indigo-600 dark:text-indigo-300";
      default:
        return "text-muted-foreground";
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
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href="/settings/templates">Templates</Link>
            </Button>
            <CreatePostDialog />
          </div>
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
                      variant="magic"
                      className={cn(
                        "px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
                        getTimePeriodColor(note.timePeriod)
                      )}
                    >
                      {getFilterLabel(note)}
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
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-green-500/10 rounded-md p-2 text-center">
                      <div className="font-semibold text-green-700 dark:text-green-400">
                        +{note.changes.added.toLocaleString()}
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        added
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
