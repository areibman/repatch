"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2Icon } from "lucide-react";
import { PatchNote } from "@/types/patch-note";
import { dbToUiPatchNote } from "@/lib/transformers";
import type { Database } from "@/lib/supabase/database.types";

export type GitHubPublishTarget = "release" | "discussion" | "both";

type PublishResponse = {
  status: "published" | "partial" | "failed";
  release?: { id: number; url: string } | null;
  discussion?: { id: number; url: string } | null;
  error?: string | null;
  patchNote?: Database["public"]["Tables"]["patch_notes"]["Row"];
};

type PublishToGitHubDialogProps = {
  patchNote: PatchNote;
  onPatchNoteChange?: (note: PatchNote) => void;
};

const targetOptions: Array<{
  value: GitHubPublishTarget;
  label: string;
  description: string;
}> = [
  {
    value: "release",
    label: "Release",
    description: "Create a GitHub release with these patch notes",
  },
  {
    value: "discussion",
    label: "Discussion",
    description: "Start a GitHub discussion in the selected category",
  },
  {
    value: "both",
    label: "Release + Discussion",
    description: "Create a release and cross-post it to a discussion",
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

function buildDefaultTagName(note: PatchNote): string {
  const repoSegment = slugify(note.repoName.replace(/\//g, "-"));
  const dateSegment = note.generatedAt.toISOString().split("T")[0];
  const base = slugify(`repatch-${repoSegment}-${note.timePeriod}-${dateSegment}`);
  if (base.length === 0) {
    return `repatch-${note.id.slice(0, 8).toLowerCase()}`;
  }
  return `${base}-${note.id.slice(0, 8).toLowerCase()}`;
}

export function PublishToGitHubDialog({
  patchNote,
  onPatchNoteChange,
}: PublishToGitHubDialogProps) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<GitHubPublishTarget>("release");
  const [tagName, setTagName] = useState<string>(() => buildDefaultTagName(patchNote));
  const [discussionCategory, setDiscussionCategory] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setTagName(buildDefaultTagName(patchNote));
  }, [patchNote.id, patchNote.generatedAt, patchNote.repoName, patchNote.timePeriod]);

  useEffect(() => {
    if (!open) {
      setFormError(null);
      setFeedback(null);
      setIsPublishing(false);
    }
  }, [open]);

  const requiresDiscussionCategory = useMemo(
    () => target === "discussion" || target === "both",
    [target]
  );

  const disabled =
    isPublishing || (patchNote.githubPublishStatus === "pending" && !isPublishing);

  async function handlePublish() {
    const trimmedTag = slugify(tagName).trim();
    if (!trimmedTag) {
      setFormError("A release tag is required.");
      return;
    }

    if (requiresDiscussionCategory) {
      const trimmedCategory = discussionCategory.trim();
      if (!trimmedCategory) {
        setFormError("Select or provide a discussion category name.");
        return;
      }
    }

    setIsPublishing(true);
    setFormError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/patch-notes/${patchNote.id}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target,
          tagName: trimmedTag,
          discussionCategoryName: requiresDiscussionCategory
            ? discussionCategory.trim()
            : undefined,
        }),
      });

      const payload = (await response.json()) as PublishResponse;

      if (payload.patchNote) {
        onPatchNoteChange?.(dbToUiPatchNote(payload.patchNote));
      }

      if (!response.ok) {
        setFormError(payload.error ?? "Failed to publish to GitHub.");
        return;
      }

      const statusLabel =
        payload.status === "partial"
          ? "Partially published to GitHub."
          : payload.status === "failed"
          ? "Failed to publish to GitHub."
          : "Successfully published to GitHub.";

      setFeedback(statusLabel);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unexpected error publishing to GitHub."
      );
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled} variant="outline">
          {isPublishing || patchNote.githubPublishStatus === "pending" ? (
            <>
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              Publishing...
            </>
          ) : (
            "Publish to GitHub"
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Publish patch note to GitHub</DialogTitle>
          <DialogDescription>
            Use your stored GitHub credentials to create a release or kick off a discussion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Publish target</legend>
            <div className="space-y-2">
              {targetOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm shadow-sm transition hover:border-primary"
                >
                  <input
                    type="radio"
                    name="github-target"
                    value={option.value}
                    checked={target === option.value}
                    onChange={() => setTarget(option.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <p className="text-muted-foreground text-xs">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="github-tag">Release tag</Label>
            <Input
              id="github-tag"
              value={tagName}
              onChange={(event) => setTagName(event.target.value)}
              placeholder="repatch-owner-repo-2025-01-01"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Tags must be unique per repository. You can adjust this slug before publishing.
            </p>
          </div>

          {requiresDiscussionCategory && (
            <div className="space-y-2">
              <Label htmlFor="github-discussion">Discussion category name</Label>
              <Input
                id="github-discussion"
                value={discussionCategory}
                onChange={(event) => setDiscussionCategory(event.target.value)}
                placeholder="Announcements"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Provide the exact discussion category name (case insensitive). We will match it before posting.
              </p>
            </div>
          )}

          {formError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}

          {feedback && (
            <div
              data-testid="github-publish-feedback"
              className="rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400"
            >
              {feedback}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={isPublishing}>
            {isPublishing ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              "Publish"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
