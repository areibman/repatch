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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CommitSummary, PatchNote, DetailedContext } from "@/types/patch-note";
import type { AiTemplate } from "@/types/ai-template";
import { formatFilterDetailLabel, formatFilterSummary } from "@/lib/filter-utils";
import {
  ArrowLeftIcon,
  PencilIcon,
  CheckIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/16/solid";
import { Loader2Icon, TwitterIcon, DownloadIcon } from "lucide-react";
import { Player } from "@remotion/player";
import { getDuration } from "@/remotion/Root";
import { ParsedPropsSchema } from "@/remotion/BaseComp";

import dynamic from "next/dynamic";

const BaseComp = dynamic(() => import("@/remotion/BaseComp"), {
  ssr: false,
});

const DEFAULT_TEMPLATE_OPTION = "__default__";

export default function BlogViewPage() {
  const params = useParams();
  const router = useRouter();
  const [patchNote, setPatchNote] = useState<PatchNote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [templates, setTemplates] = useState<AiTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateMessage, setRegenerateMessage] = useState('');
  const [showInternalChanges, setShowInternalChanges] = useState(false);
  const [showVideoTop3, setShowVideoTop3] = useState(false);
  const [editedVideoTop3, setEditedVideoTop3] = useState<Array<{ title: string; description: string }>>([]);
  const [isEditingVideoTop3, setIsEditingVideoTop3] = useState(false);
  const [isRegeneratingVideo, setIsRegeneratingVideo] = useState(false);
  const [videoRegenerationMessage, setVideoRegenerationMessage] = useState('');
  const [isTemplateCardCollapsed, setIsTemplateCardCollapsed] = useState(true);
  const [typefullyDraftUrl, setTypefullyDraftUrl] = useState<string | null>(null);
  const [providerName, setProviderName] = useState("Resend");
  const [providerConfigured, setProviderConfigured] = useState(true);

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

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  useEffect(() => {
    const fetchPatchNote = async () => {
      try {
        const response = await fetch(`/api/patch-notes/${params.id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch patch note");
        }
        const data = await response.json();

        // Transform database format to UI format
        const transformedNote: PatchNote = {
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
          repoBranch: data.repo_branch,
          aiSummaries: data.ai_summaries as CommitSummary[] | null,
          aiOverallSummary: data.ai_overall_summary,
          aiDetailedContexts: data.ai_detailed_contexts as DetailedContext[] | null,
          aiTemplateId: data.ai_template_id,
          filterMetadata: data.filter_metadata ?? null,
          videoTopChanges: data.video_top_changes ?? null,
        };

        setPatchNote(transformedNote);
        setEditedContent(transformedNote.content);
        setEditedTitle(transformedNote.title);
        setSelectedTemplateId(transformedNote.aiTemplateId ?? null);
        setEditedVideoTop3(transformedNote.videoTopChanges || []);
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
    const fetchProvider = async () => {
      try {
        const response = await fetch("/api/email/providers");
        if (!response.ok) {
          const err = await response.json().catch(() => null);
          throw new Error(err?.error || "Failed to load provider");
        }

        const data = await response.json();
        const providers = (data.providers ?? []) as Array<{
          id: string;
          name: string;
          configured: boolean;
        }>;
        const active = providers.find(
          provider => provider.id === data.activeProvider
        );

        if (active) {
          setProviderName(active.name);
          setProviderConfigured(Boolean(active.configured));
        } else if (providers.length > 0) {
          setProviderName(providers[0].name);
          setProviderConfigured(Boolean(providers[0].configured));
        } else {
          setProviderConfigured(false);
        }
      } catch (err) {
        console.error("Error loading provider info:", err);
        setProviderConfigured(false);
      }
    };

    fetchProvider();
  }, []);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setIsLoadingTemplates(true);
        setTemplateError(null);
        const response = await fetch('/api/ai-templates');
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to load templates');
        }

        const data = (await response.json()) as AiTemplate[];
        setTemplates(data);
      } catch (error) {
        console.error('Error loading templates:', error);
        setTemplateError(
          error instanceof Error ? error.message : 'Failed to load templates'
        );
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplateId && templates.length > 0) {
      const exists = templates.some((template) => template.id === selectedTemplateId);
      if (!exists) {
        setSelectedTemplateId(templates[0]?.id ?? null);
      }
    }
  }, [templates, selectedTemplateId]);

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

  const handleCreateTweetThread = async () => {
    if (!patchNote || isCreatingThread) {
      return;
    }

    if (!confirm('Draft this patch note as a Typefully tweet thread?')) {
      return;
    }

    setIsCreatingThread(true);

    try {
      const response = await fetch(`/api/patch-notes/${patchNote.id}/typefully`, {
        method: 'POST',
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMessage = data?.error || 'Failed to create Typefully draft';
        throw new Error(errorMessage);
      }

      // Extract the shareable URL from the response
      const draftUrl =
        data?.draft?.share_url ||
        data?.draft?.url ||
        data?.draft?.draft?.url ||
        data?.draft?.data?.url ||
        null;

      if (draftUrl) {
        setTypefullyDraftUrl(draftUrl);
        // Automatically open the draft in a new tab
        const newWindow = window.open(draftUrl, '_blank', 'noopener,noreferrer');
        if (newWindow) {
          newWindow.focus();
        }
      } else {
        alert('✅ Tweet thread drafted on Typefully!');
      }
    } catch (error) {
      console.error('Error creating Typefully draft:', error);
      const message = error instanceof Error ? error.message : 'Failed to create Typefully draft';
      alert(`❌ Error: ${message}`);
    } finally {
      setIsCreatingThread(false);
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

  const handleDownloadVideo = async () => {
    if (!patchNote?.videoUrl) return;

    try {
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = patchNote.videoUrl;
      link.download = `${patchNote.repoName?.replace('/', '-') || 'patch-note'}-video.mp4`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading video:', error);
      alert('❌ Error downloading video. Please try opening the video URL directly.');
    }
  };

  const handleRegenerateSummary = async () => {
    if (!patchNote || isRegenerating) {
      return;
    }

    const [owner, repo] = patchNote.repoName.split('/');
    if (!owner || !repo) {
      alert('Unable to determine repository name for regeneration.');
      return;
    }

    if (!patchNote.filterMetadata) {
      alert('Unable to regenerate: filter metadata is missing.');
      return;
    }

    try {
      setIsRegenerating(true);
      setRegenerateMessage('Analyzing commits...');

      const summarizeResponse = await fetch('/api/github/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo,
          filters: patchNote.filterMetadata,
          branch: patchNote.repoBranch || 'main',
          templateId: selectedTemplateId || undefined,
        }),
      });

      if (!summarizeResponse.ok) {
        const error = await summarizeResponse.json();
        throw new Error(error.error || 'Failed to regenerate summaries');
      }

      const summaryData = await summarizeResponse.json();
      const summaries: CommitSummary[] = summaryData.summaries || [];
      const overallSummary: string | null = summaryData.overallSummary || null;
      const formattedChanges: string | null = summaryData.formattedChanges || null;

      const newContent = overallSummary && formattedChanges
        ? `${overallSummary}\n\n${formattedChanges}`
        : patchNote.content;

      setRegenerateMessage('Saving patch note...');

      const updateResponse = await fetch(`/api/patch-notes/${patchNote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: patchNote.title,
          content: newContent,
          repo_name: patchNote.repoName,
          repo_url: patchNote.repoUrl,
          repo_branch: patchNote.repoBranch || 'main',
          time_period: patchNote.timePeriod,
          changes: patchNote.changes,
          contributors: patchNote.contributors,
          ai_summaries: summaries,
          ai_overall_summary: overallSummary,
          ai_template_id: selectedTemplateId,
        }),
      });

      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        throw new Error(error.error || 'Failed to save regenerated summary');
      }

      const updated = await updateResponse.json();

      const updatedNote: PatchNote = {
        ...patchNote,
        content: newContent,
        repoBranch: updated.repo_branch,
        aiSummaries: summaries,
        aiOverallSummary: overallSummary,
        aiTemplateId: selectedTemplateId ?? null,
      };

      setPatchNote(updatedNote);
      setEditedContent(newContent);
      setIsEditing(false);
    } catch (error) {
      console.error('Error regenerating summary:', error);
      alert(
        `Failed to regenerate summary: ${error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      setRegenerateMessage('');
      setIsRegenerating(false);
    }
  };

  const getFilterLabel = (note: PatchNote) =>
    formatFilterSummary(note.filterMetadata, note.timePeriod);

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
            {isRegeneratingVideo ? (
              <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-3 py-2 rounded shadow-md flex items-center gap-2">
                <Loader2Icon className="h-3 w-3 animate-spin" />
                <span>{videoRegenerationMessage || 'Regenerating...'}</span>
              </div>
            ) : patchNote.videoUrl ? (
              <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded shadow-md">
                ✓ Custom Video
              </div>
            ) : (
              <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded shadow-md animate-pulse">
                🎬 Checking for video...
              </div>
            )}
          </div>
          
          {/* Video Regeneration Status Banner */}
          {isRegeneratingVideo && (
            <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Loader2Icon className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 dark:text-blue-100">
                    Regenerating Video
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {videoRegenerationMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">
                  {getFilterLabel(patchNote)}
                </Badge>
                <Badge variant="outline">
                  {new Date(patchNote.generatedAt).toLocaleDateString()}
                </Badge>
              </div>
              {patchNote.filterMetadata && (
                <p className="text-xs text-muted-foreground mb-4">
                  {formatFilterDetailLabel(patchNote.filterMetadata)}
                </p>
              )}

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
                  {!patchNote.videoUrl ? (
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
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadVideo}
                    >
                      <DownloadIcon className="h-4 w-4 mr-2" />
                      Download Video
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCreateTweetThread}
                    disabled={isCreatingThread}
                  >
                    {isCreatingThread ? (
                      <>
                        <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                        Drafting...
                      </>
                    ) : (
                      <>
                        <TwitterIcon className="h-4 w-4 mr-2" />
                        {typefullyDraftUrl ? 'Redraft' : 'Draft'} Tweet Thread
                      </>
                    )}
                  </Button>
                  <div className="flex flex-col items-start gap-1">
                    <Button
                      size="sm"
                      onClick={handleSendEmail}
                      disabled={isSending || !providerConfigured}
                    >
                      <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                      {isSending
                        ? `Sending via ${providerName}...`
                        : providerConfigured
                          ? `Send Email via ${providerName}`
                          : "Configure Email Provider"}
                    </Button>
                    {!providerConfigured && (
                      <span className="text-xs text-destructive">
                        Add {providerName} credentials in Settings → Email to
                        enable sending.
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Typefully Draft Link */}
        {typefullyDraftUrl && (
          <a
            href={typefullyDraftUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-6 block"
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 hover:bg-muted rounded-lg border transition-colors">
              <TwitterIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Draft created on Typefully
              </span>
              <span className="text-sm text-foreground ml-auto font-medium">
                Open →
              </span>
            </div>
          </a>
        )}

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
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle>Patch Notes</CardTitle>
                <CardDescription>
                  {showVideoTop3
                    ? "Edit top 3 changes displayed in the video animation"
                    : showInternalChanges 
                    ? "Detailed technical analysis (Step 1) that was fed into the final changelog"
                    : "AI-generated summary of changes for this period"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                {!showInternalChanges && !showVideoTop3 && !isEditing && (
                  <span className="text-sm text-muted-foreground">
                    {patchNote.content.length.toLocaleString()} characters
                  </span>
                )}
                {isEditing && (
                  <span className="text-sm text-muted-foreground">
                    {editedContent.length.toLocaleString()} characters
                  </span>
                )}
                {patchNote.aiDetailedContexts && patchNote.aiDetailedContexts.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Button
                      variant={!showInternalChanges && !showVideoTop3 ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setShowInternalChanges(false);
                        setShowVideoTop3(false);
                      }}
                    >
                      Final Output
                    </Button>
                    <Button
                      variant={showInternalChanges ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setShowInternalChanges(true);
                        setShowVideoTop3(false);
                      }}
                    >
                      Internal Changes ({patchNote.aiDetailedContexts.length})
                    </Button>
                    <Button
                      variant={showVideoTop3 ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setShowInternalChanges(false);
                        setShowVideoTop3(true);
                      }}
                    >
                      Video Content
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[500px] font-mono text-sm"
                placeholder="Enter patch notes content..."
              />
            ) : showInternalChanges && patchNote.aiDetailedContexts && patchNote.aiDetailedContexts.length > 0 ? (
              <div className="space-y-6">
                {/* Template Controls */}
                <div className="bg-muted/30 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <Label htmlFor="template-select" className="text-sm font-medium mb-2 block">
                        Output Template
                      </Label>
                      <Select
                        value={selectedTemplateId ?? DEFAULT_TEMPLATE_OPTION}
                        onValueChange={(value) =>
                          setSelectedTemplateId(
                            value === DEFAULT_TEMPLATE_OPTION ? null : value
                          )
                        }
                        disabled={isRegenerating || isLoadingTemplates}
                      >
                        <SelectTrigger id="template-select" data-testid="detail-template-select">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={DEFAULT_TEMPLATE_OPTION}>
                            System Default
                          </SelectItem>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="pt-6">
                      <Button
                        onClick={handleRegenerateSummary}
                        disabled={isRegenerating || isLoadingTemplates}
                        size="default"
                        data-testid="regenerate-template-button"
                      >
                        {isRegenerating ? (
                          <>
                            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                            {regenerateMessage || 'Regenerating...'}
                          </>
                        ) : (
                          'Regenerate with Template'
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Template Preview */}
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                      Preview Template ({selectedTemplate?.content.length || 0} chars)
                    </summary>
                    <div className="mt-3 rounded-md border bg-background p-3">
                      <div className="max-h-48 overflow-y-auto prose prose-sm max-w-none whitespace-pre-wrap text-xs text-muted-foreground">
                        {selectedTemplate?.content || 'Balanced tone with concise technical highlights.'}
                      </div>
                    </div>
                  </details>

                  {patchNote.repoBranch && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      Generated from branch <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{patchNote.repoBranch}</span>
                    </div>
                  )}
                </div>

                {/* Internal Change Summaries */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Step 1: Internal Technical Summaries
                  </h3>
                  {patchNote.aiDetailedContexts.map((ctx, index) => (
                    <details key={index} className="group rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                      <summary className="cursor-pointer font-medium text-sm mb-2 flex items-start gap-2">
                        <span className="flex-shrink-0 text-muted-foreground">#{index + 1}</span>
                        <span className="flex-1">{ctx.message.split('\n')[0]}</span>
                        <span className="text-xs text-muted-foreground">
                          +{ctx.additions} -{ctx.deletions}
                        </span>
                      </summary>
                      <div className="mt-3 pl-6 space-y-3 text-sm">
                        <div className="bg-muted/30 p-3 rounded-md">
                          <p className="text-muted-foreground whitespace-pre-wrap">{ctx.context}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>
                            <strong>Authors:</strong> {ctx.authors.join(', ')}
                          </span>
                          {ctx.prNumber && (
                            <span>
                              <strong>PR:</strong>{' '}
                              <a
                                href={`${patchNote.repoUrl}/pull/${ctx.prNumber}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                #{ctx.prNumber}
                              </a>
                            </span>
                          )}
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ) : showVideoTop3 ? (
              <div className="space-y-6">
                {/* Generate Button */}
                <div className="flex items-center justify-between bg-muted/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    {editedVideoTop3.length === 0
                      ? "Generate video-optimized top 3 changes from the final changelog"
                      : `${editedVideoTop3.length} change${editedVideoTop3.length !== 1 ? 's' : ''} configured`}
                  </p>
                  <div className="flex gap-2">
                    {editedVideoTop3.length === 0 && (
                      <Button
                        onClick={async () => {
                          try {
                            setIsGeneratingVideo(true);
                            
                            // Call the LLM to generate top 3 from final content
                            const response = await fetch('/api/patch-notes/generate-video-top3', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                content: patchNote.content,
                                repoName: patchNote.repoName,
                              }),
                            });
                            
                            if (!response.ok) throw new Error('Failed to generate video top 3');
                            
                            const data = await response.json();
                            setEditedVideoTop3(data.topChanges);
                            setIsEditingVideoTop3(true);
                          } catch (error) {
                            console.error('Error generating video top 3:', error);
                            alert('Failed to generate video top 3');
                          } finally {
                            setIsGeneratingVideo(false);
                          }
                        }}
                        disabled={isGeneratingVideo}
                      >
                        {isGeneratingVideo ? (
                          <>
                            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          'Generate Top 3'
                        )}
                      </Button>
                    )}
                    {editedVideoTop3.length > 0 && !isEditingVideoTop3 && (
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingVideoTop3(true)}
                      >
                        <PencilIcon className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    )}
                    {isEditingVideoTop3 && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditingVideoTop3(false);
                            setEditedVideoTop3(patchNote.videoTopChanges || []);
                          }}
                        >
                          <XMarkIcon className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button
                          onClick={async () => {
                            try {
                              setIsSaving(true);
                              setVideoRegenerationMessage('Saving Video Top 3...');
                              
                              const response = await fetch(`/api/patch-notes/${patchNote.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  video_top_changes: editedVideoTop3,
                                }),
                              });
                              
                              if (!response.ok) throw new Error('Failed to save');
                              
                              const updated = await response.json();
                              setPatchNote({
                                ...patchNote,
                                videoTopChanges: updated.video_top_changes,
                              });
                              setIsEditingVideoTop3(false);
                              
                              // Trigger video regeneration
                              setVideoRegenerationMessage('Regenerating video with new changes...');
                              setIsRegeneratingVideo(true);
                              
                              const videoResponse = await fetch('/api/videos/render', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  patchNoteId: patchNote.id,
                                  videoData: {
                                    langCode: 'en',
                                    topChanges: editedVideoTop3,
                                    allChanges: [],
                                  },
                                  repoName: patchNote.repoName,
                                }),
                              });
                              
                              if (videoResponse.ok) {
                                const videoData = await videoResponse.json();
                                setVideoRegenerationMessage('Video rendered successfully!');
                                
                                // Update patch note with new video URL
                                setPatchNote({
                                  ...patchNote,
                                  videoTopChanges: updated.video_top_changes,
                                  videoUrl: videoData.videoUrl,
                                });
                                
                                setTimeout(() => {
                                  setVideoRegenerationMessage('');
                                  setIsRegeneratingVideo(false);
                                  alert('Video Top 3 saved and video regenerated successfully!');
                                }, 1500);
                              } else {
                                setVideoRegenerationMessage('Video regeneration queued (processing in background)');
                                setTimeout(() => {
                                  setVideoRegenerationMessage('');
                                  setIsRegeneratingVideo(false);
                                  alert('Video Top 3 saved! Video is being regenerated in the background.');
                                }, 2000);
                              }
                            } catch (error) {
                              console.error('Error saving video top 3:', error);
                              alert('Failed to save video top 3');
                              setVideoRegenerationMessage('');
                              setIsRegeneratingVideo(false);
                            } finally {
                              setIsSaving(false);
                            }
                          }}
                          disabled={isSaving || isRegeneratingVideo}
                        >
                          {isSaving || isRegeneratingVideo ? (
                            <>
                              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                              {videoRegenerationMessage || 'Saving...'}
                            </>
                          ) : (
                            <>
                              <CheckIcon className="h-4 w-4 mr-2" />
                              Save & Regenerate Video
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Video Top 3 Edit Fields */}
                {editedVideoTop3.length > 0 && (
                  <div className="space-y-6">
                    {editedVideoTop3.map((change, index) => (
                      <Card key={index} className="border-2">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary">Change #{index + 1}</Badge>
                            {isEditingVideoTop3 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newChanges = editedVideoTop3.filter((_, i) => i !== index);
                                  setEditedVideoTop3(newChanges);
                                }}
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <Label htmlFor={`title-${index}`} className="text-sm font-medium">
                              Title (2-4 words, max 40 chars)
                            </Label>
                            {isEditingVideoTop3 ? (
                              <input
                                id={`title-${index}`}
                                type="text"
                                value={change.title}
                                onChange={(e) => {
                                  const newChanges = [...editedVideoTop3];
                                  newChanges[index].title = e.target.value;
                                  setEditedVideoTop3(newChanges);
                                }}
                                className="mt-1 w-full px-3 py-2 border rounded-md text-lg font-bold"
                                placeholder="e.g., Real-time Search Index"
                                maxLength={40}
                              />
                            ) : (
                              <p className="mt-1 text-lg font-bold">{change.title}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {change.title.length}/40 characters
                            </p>
                          </div>
                          
                          <div>
                            <Label htmlFor={`desc-${index}`} className="text-sm font-medium">
                              Description (1-2 sentences, 15-25 words, max 150 chars)
                            </Label>
                            {isEditingVideoTop3 ? (
                              <Textarea
                                id={`desc-${index}`}
                                value={change.description}
                                onChange={(e) => {
                                  const newChanges = [...editedVideoTop3];
                                  newChanges[index].description = e.target.value;
                                  setEditedVideoTop3(newChanges);
                                }}
                                className="mt-1 min-h-[100px]"
                                placeholder="e.g., Index content in real-time for fast, filtered search. Powered by Pinecone with RRF ranking."
                                maxLength={150}
                              />
                            ) : (
                              <p className="mt-1 text-sm leading-relaxed">{change.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {change.description.length}/150 characters
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {isEditingVideoTop3 && editedVideoTop3.length < 3 && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setEditedVideoTop3([
                            ...editedVideoTop3,
                            { title: '', description: '' },
                          ]);
                        }}
                      >
                        Add Change
                      </Button>
                    )}
                  </div>
                )}
                
                {editedVideoTop3.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No video top 3 changes configured.</p>
                    <p className="text-sm mt-2">Click "Generate Top 3" to automatically extract from your final changelog.</p>
                  </div>
                )}
              </div>
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
