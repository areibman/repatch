"use client";

import { PatchNote } from "@/types/patch-note";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/16/solid";

const statusConfig: Record<
  PatchNote["githubPublishStatus"],
  { label: string; tone: "muted" | "info" | "success" | "warning" | "danger" }
> = {
  idle: { label: "Not published", tone: "muted" },
  pending: { label: "Publishing", tone: "info" },
  published: { label: "Published", tone: "success" },
  partial: { label: "Partially published", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
};

const toneStyles: Record<
  (typeof statusConfig)[keyof typeof statusConfig]["tone"],
  { badge: string; container: string; message: string }
> = {
  muted: {
    badge: "bg-muted text-muted-foreground border-transparent",
    container: "border-dashed",
    message: "text-muted-foreground",
  },
  info: {
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    container: "border-blue-500/20",
    message: "text-blue-700 dark:text-blue-300",
  },
  success: {
    badge: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30",
    container: "border-green-500/20",
    message: "text-green-700 dark:text-green-300",
  },
  warning: {
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    container: "border-amber-500/20",
    message: "text-amber-700 dark:text-amber-300",
  },
  danger: {
    badge: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
    container: "border-red-500/20",
    message: "text-red-700 dark:text-red-300",
  },
};

function formatTarget(target?: PatchNote["githubPublishTarget"] | null) {
  if (!target) return "Release";
  switch (target) {
    case "both":
      return "Release & Discussion";
    case "discussion":
      return "Discussion";
    default:
      return "Release";
  }
}

function formatPublishedAt(date?: Date | null) {
  if (!date) return null;
  return date.toLocaleString();
}

type GitHubPublishStatusProps = {
  patchNote: PatchNote;
  className?: string;
};

export function GitHubPublishStatus({ patchNote, className }: GitHubPublishStatusProps) {
  const status = statusConfig[patchNote.githubPublishStatus] ?? statusConfig.idle;
  const tone = toneStyles[status.tone];
  const publishedAt = formatPublishedAt(patchNote.githubPublishedAt);

  let message = "This patch note has not been published to GitHub yet.";
  if (patchNote.githubPublishStatus === "pending") {
    message = "We are waiting for GitHub to confirm the release/discussion.";
  } else if (patchNote.githubPublishStatus === "published") {
    message = "GitHub metadata is synced.";
  } else if (patchNote.githubPublishStatus === "partial") {
    message = "Some GitHub targets succeeded, but at least one failed.";
  } else if (patchNote.githubPublishStatus === "failed") {
    message = "The last publish attempt failed.";
  }

  return (
    <div
      data-testid="github-publish-status"
      className={cn(
        "rounded-md border px-4 py-3 shadow-sm transition",
        tone.container,
        className
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("font-medium", tone.badge)}>{status.label}</Badge>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Target: {formatTarget(patchNote.githubPublishTarget)}
            </span>
            {publishedAt && (
              <span className="text-xs text-muted-foreground">Last published {publishedAt}</span>
            )}
          </div>
          <p className={cn("text-sm", tone.message)}>{message}</p>
          {patchNote.githubPublishError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Error: {patchNote.githubPublishError}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {patchNote.githubRelease && (
            <a
              href={patchNote.githubRelease.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View release
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            </a>
          )}
          {patchNote.githubDiscussion && (
            <a
              href={patchNote.githubDiscussion.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View discussion
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
