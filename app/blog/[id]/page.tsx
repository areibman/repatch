"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GitHubPublishStatus,
  GitHubPublishTarget,
  PatchNote,
} from "@/types/patch-note";
import {
  ArrowLeftIcon,
  PencilIcon,
  CheckIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import { Loader2Icon } from "lucide-react";
import { Player } from "@remotion/player";
import { getDuration } from "@/remotion/Root";
import { ParsedPropsSchema } from "@/remotion/BaseComp";
import { cn } from "@/lib/utils";

import dynamic from "next/dynamic";

const BaseComp = dynamic(() => import("@/remotion/BaseComp"), {
  ssr: false,
});

const STATUS_METADATA: Record<GitHubPublishStatus, { label: string; className: string }> = {
  idle: {
    label: "Not published",
    className: "border-muted bg-muted/20 text-muted-foreground",
  },
  publishing: {
    label: "Publishing…",
    className:
      "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  published: {
    label: "Published",
    className:
      "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  failed: {
    label: "Failed",
    className: "border-destructive/50 bg-destructive/10 text-destructive",
  },
};

function formatDateTime(date: Date | null | undefined) {
  if (!date) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function transformPatchNoteResponse(data: any): PatchNote {
  return {
    id: data.id,
    repoName: data.repo_name,
    repoUrl: data.repo_url,
    timePeriod: data.time_period,
    generatedAt: new Date(data.generated_at),
    title: data.title,
    content: data.content,
    changes: data.changes,
    contributors: data.contributors,
    videoUrl: data.video_url,
    videoData: data.video_data ?? undefined,
    githubPublishTarget: data.github_publish_target ?? null,
    githubPublishStatus: (data.github_publish_status ?? "idle") as GitHubPublishStatus,
    githubPublishError: data.github_publish_error ?? null,
    githubReleaseId: data.github_release_id ?? null,
    githubReleaseUrl: data.github_release_url ?? null,
    githubReleaseTag: data.github_release_tag ?? null,
    githubDiscussionId: data.github_discussion_id ?? null,
    githubDiscussionUrl: data.github_discussion_url ?? null,
    githubDiscussionCategorySlug: data.github_discussion_category_slug ?? null,
    githubPublishAttempts: data.github_publish_attempts ?? 0,
    githubLastPublishedAt: data.github_last_published_at
      ? new Date(data.github_last_published_at)
      : null,
    githubPublishNextRetryAt: data.github_publish_next_retry_at
      ? new Date(data.github_publish_next_retry_at)
      : null,
  };
}

export default function BlogViewPage() {
  const params = useParams();
  const router = useRouter();
  const [patchNote, setPatchNote] = useState<PatchNote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishTarget, setPublishTarget] =
    useState<GitHubPublishTarget>("release");
  const [releaseTagName, setReleaseTagName] = useState("");
  const [discussionCategory, setDiscussionCategory] =
    useState("announcements");

  // Calculate duration from patch note's video data
  const videoDuration = useMemo(() => {
    try {
      if (patchNote?.videoData) {
        return getDuration(patchNote.videoData);
      }
      return 30 * 4; // fallback duration
    } catch {
      return 30 * 4; // fallback duration
    }
  }, [patchNote?.videoData]);

  useEffect(() => {
    const fetchPatchNote = async () => {
      try {
        const response = await fetch(`/api/patch-notes/${params.id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch patch note");
        }
        const data = await response.json();

        // Transform database format to UI format
        const transformedNote = transformPatchNoteResponse(data);

        setPatchNote(transformedNote);
        setEditedContent(transformedNote.content);
        setEditedTitle(transformedNote.title);
      } catch (error) {
        console.error("Error fetching patch note:", error);
      }
    };

    fetchPatchNote();
    
    // Poll for video status every 5 seconds if no video exists yet
    const pollInterval = setInterval(async () => {
      if (!patchNote?.videoUrl) {
        const statusResponse = await fetch(`/api/videos/status/${params.id}`);
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          if (status.hasVideo && status.videoUrl) {
            console.log('Video is ready! Refreshing...');
            fetchPatchNote(); // Refresh the patch note data
          }
        }
      }
    }, 5000);
    
    // Cleanup interval on unmount
    return () => clearInterval(pollInterval);
  }, [params.id, patchNote?.videoUrl]);

  useEffect(() => {
    if (!patchNote) {
      return;
    }

    if (patchNote.githubPublishTarget) {
      setPublishTarget(patchNote.githubPublishTarget);
    }

    if (patchNote.githubReleaseTag) {
      setReleaseTagName(patchNote.githubReleaseTag);
    }

    if (patchNote.githubDiscussionCategorySlug) {
      setDiscussionCategory(patchNote.githubDiscussionCategorySlug);
    }
  }, [patchNote]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (patchNote) {
      setEditedContent(patchNote.content);
      setEditedTitle(patchNote.title);
    }
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/patch-notes/${params.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editedTitle,
          content: editedContent,
          repo_name: patchNote?.repoName,
          repo_url: patchNote?.repoUrl,
          time_period: patchNote?.timePeriod,
          changes: patchNote?.changes,
          contributors: patchNote?.contributors,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save changes");
      }

      await response.json();

      if (patchNote) {
        setPatchNote({
          ...patchNote,
          title: editedTitle,
          content: editedContent,
        });
      }

      setIsEditing(false);
    } catch (error) {
      console.error("Error saving patch note:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendEmail = async () => {
    // Prevent multiple calls
    if (isSending) {
      return;
    }

    if (!confirm('Send this patch note to all email subscribers?')) {
      return;
    }

    setIsSending(true);
    
    try {
      const response = await fetch(`/api/patch-notes/${params.id}/send`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      const data = await response.json();
      alert(`✅ Patch note successfully sent to ${data.sentTo} subscriber${data.sentTo !== 1 ? 's' : ''}!`);
    } catch (error) {
      console.error('Error sending email:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send email';
      alert(`❌ Error: ${errorMessage}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!patchNote) return;

    setIsGeneratingVideo(true);
    try {
      const response = await fetch('/api/videos/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patchNoteId: patchNote.id,
          videoData: patchNote.videoData,
          repoName: patchNote.repoName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate video');
      }

      const data = await response.json();
      
      // Update the patch note with the new video URL
      setPatchNote({
        ...patchNote,
        videoUrl: data.videoUrl,
      });
      
      alert('✅ Video generated successfully! The page will refresh.');
      window.location.reload();
    } catch (error) {
      console.error('Error generating video:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate video';
      alert(`❌ Error: ${errorMessage}`);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handlePublishToGitHub = async () => {
    if (!patchNote || isPublishing) {
      return;
    }

    setIsPublishing(true);

    const payload: Record<string, unknown> = {
      target: publishTarget,
    };

    if (publishTarget === "release" && releaseTagName.trim()) {
      payload.tagName = releaseTagName.trim();
    }

    if (publishTarget === "discussion" && discussionCategory.trim()) {
      payload.discussionCategorySlug = discussionCategory.trim();
    }

    try {
      const response = await fetch(`/api/patch-notes/${params.id}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const message = data?.error || "Failed to publish patch note to GitHub.";
        if (data?.patchNote) {
          setPatchNote(transformPatchNoteResponse(data.patchNote));
        }
        alert(`❌ ${message}`);
        return;
      }

      const updatedNote = transformPatchNoteResponse(data);
      setPatchNote(updatedNote);
      setEditedContent(updatedNote.content);
      setEditedTitle(updatedNote.title);

      if (updatedNote.githubReleaseTag) {
        setReleaseTagName(updatedNote.githubReleaseTag);
      }

      if (updatedNote.githubDiscussionCategorySlug) {
        setDiscussionCategory(updatedNote.githubDiscussionCategorySlug);
      }
    } catch (error) {
      console.error("Error publishing patch note to GitHub:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to publish patch note to GitHub.";
      alert(`❌ ${message}`);
    } finally {
      setIsPublishing(false);
    }
  };

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

  if (!patchNote) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const currentStatus: GitHubPublishStatus =
    patchNote.githubPublishStatus ?? "idle";
  const statusInfo = STATUS_METADATA[currentStatus];
  const lastPublishedLabel = formatDateTime(patchNote.githubLastPublishedAt);
  const nextRetryLabel = formatDateTime(patchNote.githubPublishNextRetryAt);
  const disablePublishButton =
    isPublishing || patchNote.githubPublishStatus === "publishing";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Home
          </Button>

          {/* Hero Image/Video */}
          <div className="mb-6 rounded-lg overflow-hidden shadow-lg relative">
            <a 
              href={patchNote.videoUrl || "https://openedit-uploads.openchatui.com/basecomp.mp4"} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:opacity-90 transition-opacity"
            >
              <img 
                src="https://openedit-uploads.openchatui.com/CleanShot%202025-10-04%20at%205%E2%80%AF.21.46.png" 
                alt="Watch Patch Note Video" 
                className="w-full h-auto"
              />
            </a>
            {patchNote.videoUrl ? (
              <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded shadow-md">
                ✓ Custom Video
              </div>
            ) : (
              <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded shadow-md animate-pulse">
                🎬 Checking for video...
              </div>
            )}
          </div>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">
                  {getTimePeriodLabel(patchNote.timePeriod)}
                </Badge>
                <Badge variant="outline">
                  {new Date(patchNote.generatedAt).toLocaleDateString()}
                </Badge>
              </div>

              {isEditing ? (
                <Textarea
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-3xl font-bold mb-2 min-h-[60px] resize-none"
                  placeholder="Enter title..."
                />
              ) : (
                <h1 className="text-4xl font-bold mb-2">{patchNote.title}</h1>
              )}

              <a
                href={patchNote.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {patchNote.repoName}
              </a>
            </div>

            <div className="flex gap-2 flex-wrap">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancel}>
                    <XMarkIcon className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    <CheckIcon className="h-4 w-4 mr-2" />
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    <PencilIcon className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  {!patchNote.videoUrl && (
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateVideo} 
                      disabled={isGeneratingVideo || !patchNote.videoData}
                    >
                      {isGeneratingVideo ? (
                        <>
                          <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          🎬 Generate Video
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleSendEmail}
                    disabled={isSending}
                  >
                    <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                    {isSending ? "Sending..." : "Send Email"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>GitHub Publishing</CardTitle>
            <CardDescription>
              Publish this patch note to a GitHub release or discussion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                variant="outline"
                data-testid="github-status-badge"
                className={cn(
                  "border px-3 py-1 text-xs font-medium",
                  statusInfo.className
                )}
              >
                {statusInfo.label}
              </Badge>
              {lastPublishedLabel && (
                <span
                  className="text-xs text-muted-foreground"
                  data-testid="github-last-published"
                >
                  Last published {lastPublishedLabel}
                </span>
              )}
              {patchNote.githubPublishAttempts ? (
                <span className="text-xs text-muted-foreground">
                  Attempts: {patchNote.githubPublishAttempts}
                </span>
              ) : null}
              {nextRetryLabel && currentStatus === "failed" && (
                <span
                  className="text-xs text-muted-foreground"
                  data-testid="github-next-retry"
                >
                  Next retry {nextRetryLabel}
                </span>
              )}
            </div>

            {patchNote.githubPublishError && (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                data-testid="github-error"
              >
                {patchNote.githubPublishError}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Publish to
                </label>
                <Select
                  value={publishTarget}
                  onValueChange={(value) =>
                    setPublishTarget(value as GitHubPublishTarget)
                  }
                >
                  <SelectTrigger
                    className="w-full"
                    data-testid="github-target-select"
                  >
                    <SelectValue placeholder="Select GitHub surface" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="release">Release</SelectItem>
                    <SelectItem value="discussion">Discussion</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {publishTarget === "release" ? (
                <div className="space-y-2">
                  <label
                    htmlFor="github-release-tag"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    Release tag
                  </label>
                  <Input
                    id="github-release-tag"
                    value={releaseTagName}
                    onChange={(event) => setReleaseTagName(event.target.value)}
                    placeholder="v1.0.0"
                    data-testid="github-tag-input"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label
                    htmlFor="github-discussion-category"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    Discussion category slug
                  </label>
                  <Input
                    id="github-discussion-category"
                    value={discussionCategory}
                    onChange={(event) =>
                      setDiscussionCategory(event.target.value)
                    }
                    placeholder="announcements"
                    data-testid="github-discussion-input"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button
                onClick={handlePublishToGitHub}
                disabled={disablePublishButton}
                data-testid="github-publish-button"
              >
                {disablePublishButton ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  "Publish to GitHub"
                )}
              </Button>

              {patchNote.githubReleaseUrl && (
                <a
                  href={patchNote.githubReleaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                  data-testid="github-release-link"
                >
                  View release
                </a>
              )}

              {patchNote.githubDiscussionUrl && (
                <a
                  href={patchNote.githubDiscussionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                  data-testid="github-discussion-link"
                >
                  View discussion
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Remotion Player */}
        <div className="mb-8">
          <Player
            component={BaseComp as any}
            durationInFrames={videoDuration}
            fps={30}
            compositionHeight={1080}
            compositionWidth={2160}
            controls
            style={{
              width: "100%",
              height: "100%",
            }}
            inputProps={{
              repositorySlug: patchNote.repoName,
              releaseTag: "latest",
              openaiGeneration: patchNote.videoData || {
                langCode: "en",
                topChanges: [],
                allChanges: [],
              },
              langCode: patchNote.videoData?.langCode || "en",
            }}
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Lines Added</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                +{patchNote.changes.added.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Lines Removed</CardDescription>
              <CardTitle className="text-3xl text-red-600">
                -{patchNote.changes.removed.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Contributors</CardDescription>
              <CardTitle className="text-3xl text-blue-600">
                {patchNote.contributors.length}
              </CardTitle>
              <CardDescription>
                contributor{patchNote.contributors.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Patch Notes</CardTitle>
            <CardDescription>
              AI-generated summary of changes for this period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[500px] font-mono text-sm"
                placeholder="Enter patch notes content..."
              />
            ) : (
              <div className="prose prose-neutral dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {patchNote.content}
                </ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contributors */}
        <Card>
          <CardHeader>
            <CardTitle>Contributors</CardTitle>
            <CardDescription>
              Thanks to everyone who contributed to this release
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {patchNote.contributors.map((contributor) => (
                <Badge key={contributor} variant="secondary">
                  {contributor}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
