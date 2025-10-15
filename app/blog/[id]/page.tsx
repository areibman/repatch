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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
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

import dynamic from "next/dynamic";
import { Database } from "@/lib/supabase/database.types";

const BaseComp = dynamic(() => import("@/remotion/BaseComp"), {
  ssr: false,
});

type PatchNoteRow = Database["public"]["Tables"]["patch_notes"]["Row"];

function mapDbPatchNote(row: PatchNoteRow): PatchNote {
  return {
    id: row.id,
    repoName: row.repo_name,
    repoUrl: row.repo_url,
    timePeriod: row.time_period,
    generatedAt: new Date(row.generated_at),
    title: row.title,
    content: row.content,
    changes: row.changes,
    contributors: row.contributors,
    videoData: row.video_data
      ? (row.video_data as PatchNote["videoData"])
      : undefined,
    videoUrl: row.video_url,
    githubPublishStatus: row.github_publish_status,
    githubPublishTarget: row.github_publish_target,
    githubReleaseId: row.github_release_id,
    githubReleaseUrl: row.github_release_url,
    githubDiscussionId: row.github_discussion_id,
    githubDiscussionUrl: row.github_discussion_url,
    githubPublishAttemptedAt: row.github_publish_attempted_at
      ? new Date(row.github_publish_attempted_at)
      : null,
    githubPublishCompletedAt: row.github_publish_completed_at
      ? new Date(row.github_publish_completed_at)
      : null,
    githubPublishError: row.github_publish_error,
  };
}

export default function BlogViewPage() {
  const params = useParams();
  const router = useRouter();
  const patchNoteId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [patchNote, setPatchNote] = useState<PatchNote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activePublishTarget, setActivePublishTarget] =
    useState<GitHubPublishTarget | null>(null);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const getPublishStatusLabel = (
    status: PatchNote["githubPublishStatus"]
  ): string => {
    switch (status) {
      case "publishing":
        return "Publishing";
      case "published":
        return "Published";
      case "failed":
        return "Publish Failed";
      default:
        return "Not Published";
    }
  };

  const getPublishStatusBadgeClass = (
    status: PatchNote["githubPublishStatus"]
  ): string => {
    switch (status) {
      case "published":
        return "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
      case "publishing":
        return "bg-blue-500/10 text-blue-600 border border-blue-500/20";
      case "failed":
        return "bg-red-500/10 text-red-600 border border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatDateTime = (value?: Date | null) =>
    value ? value.toLocaleString() : null;

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
    if (!patchNoteId) {
      return;
    }

    const fetchPatchNote = async () => {
      try {
        const response = await fetch(`/api/patch-notes/${patchNoteId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch patch note");
        }
        const data: PatchNoteRow = await response.json();

        const transformedNote = mapDbPatchNote(data);

        setPatchNote(transformedNote);
        setEditedContent(transformedNote.content);
        setEditedTitle(transformedNote.title);
        setPublishFeedback(null);
        setPublishError(null);
      } catch (error) {
        console.error("Error fetching patch note:", error);
      }
    };

    fetchPatchNote();

    // Poll for video status every 5 seconds if no video exists yet
    const pollInterval = setInterval(async () => {
      if (!patchNote?.videoUrl) {
        const statusResponse = await fetch(`/api/videos/status/${patchNoteId}`);
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
  }, [patchNoteId, patchNote?.videoUrl]);

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
      if (!patchNoteId) {
        throw new Error("Missing patch note identifier");
      }

      const response = await fetch(`/api/patch-notes/${patchNoteId}`, {
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
      if (!patchNoteId) {
        throw new Error("Missing patch note identifier");
      }

      const response = await fetch(`/api/patch-notes/${patchNoteId}/send`, {
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

  const handlePublish = async (target: GitHubPublishTarget) => {
    if (!patchNoteId || !patchNote) {
      return;
    }

    setIsPublishing(true);
    setActivePublishTarget(target);
    setPublishFeedback(null);
    setPublishError(null);
    setPatchNote((prev) =>
      prev
        ? {
            ...prev,
            githubPublishStatus: "publishing",
            githubPublishTarget: target,
            githubPublishError: null,
          }
        : prev
    );

    try {
      const response = await fetch(`/api/patch-notes/${patchNoteId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ target }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to publish to GitHub");
      }

      if (!payload?.patchNote) {
        throw new Error("Publish response did not include patch note data");
      }

      const updatedRow = payload.patchNote as PatchNoteRow;
      const updatedNote = mapDbPatchNote(updatedRow);

      setPatchNote(updatedNote);
      setPublishFeedback(
        target === "release"
          ? "Published to GitHub Releases successfully."
          : "Published to GitHub Discussions successfully."
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to publish to GitHub";

      setPublishError(message);
      setPatchNote((prev) =>
        prev
          ? {
              ...prev,
              githubPublishStatus: "failed",
              githubPublishTarget: target,
              githubPublishError: message,
            }
          : prev
      );
    } finally {
      setIsPublishing(false);
      setActivePublishTarget(null);
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

        <Card className="mb-8" data-testid="github-publish-card">
          <CardHeader>
            <CardTitle>Publish to GitHub</CardTitle>
            <CardDescription>
              Share this patch note as a GitHub release or discussion to keep
              your community in the loop.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                variant="outline"
                className={getPublishStatusBadgeClass(
                  patchNote.githubPublishStatus
                )}
                data-testid="github-publish-status"
              >
                {getPublishStatusLabel(patchNote.githubPublishStatus)}
              </Badge>
              {patchNote.githubPublishTarget && (
                <span
                  className="text-sm text-muted-foreground"
                  data-testid="github-publish-target"
                >
                  Target:{" "}
                  {patchNote.githubPublishTarget === "release"
                    ? "GitHub Release"
                    : "GitHub Discussion"}
                </span>
              )}
            </div>
            {publishFeedback && (
              <p
                className="text-sm text-emerald-600"
                data-testid="github-publish-feedback"
              >
                {publishFeedback}
              </p>
            )}
            {(publishError || patchNote.githubPublishError) && (
              <p
                className="text-sm text-destructive"
                data-testid="github-publish-error"
              >
                {publishError || patchNote.githubPublishError}
              </p>
            )}
            <div className="space-y-2 text-sm text-muted-foreground">
              {patchNote.githubReleaseUrl && (
                <a
                  href={patchNote.githubReleaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline hover:no-underline"
                  data-testid="github-release-link"
                >
                  View published GitHub release
                </a>
              )}
              {patchNote.githubDiscussionUrl && (
                <a
                  href={patchNote.githubDiscussionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline hover:no-underline"
                  data-testid="github-discussion-link"
                >
                  View published GitHub discussion
                </a>
              )}
              {patchNote.githubPublishAttemptedAt && (
                <p data-testid="github-publish-attempted">
                  Last attempted: {formatDateTime(patchNote.githubPublishAttemptedAt)}
                </p>
              )}
              {patchNote.githubPublishCompletedAt && (
                <p data-testid="github-publish-completed">
                  Last published: {formatDateTime(patchNote.githubPublishCompletedAt)}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePublish("release")}
              disabled={
                isPublishing ||
                patchNote.githubPublishStatus === "publishing"
              }
              data-testid="publish-release-button"
            >
              {isPublishing && activePublishTarget === "release" ? (
                <>
                  <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                "Publish GitHub Release"
              )}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePublish("discussion")}
              disabled={
                isPublishing ||
                patchNote.githubPublishStatus === "publishing"
              }
              data-testid="publish-discussion-button"
            >
              {isPublishing && activePublishTarget === "discussion" ? (
                <>
                  <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                "Publish GitHub Discussion"
              )}
            </Button>
          </CardFooter>
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
