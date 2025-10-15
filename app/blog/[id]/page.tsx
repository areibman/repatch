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
import { PatchNote } from "@/types/patch-note";
import { AiTemplate } from "@/types/ai-template";
import {
  ArrowLeftIcon,
  PencilIcon,
  CheckIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { Player } from "@remotion/player";
import { getDuration } from "@/remotion/Root";
import { ParsedPropsSchema } from "@/remotion/BaseComp";
import { formatPatchNoteContentFromSummaries } from "@/lib/patch-note-format";
import { CommitSummary } from "@/lib/ai-summarizer";

import dynamic from "next/dynamic";

const BaseComp = dynamic(() => import("@/remotion/BaseComp"), {
  ssr: false,
});

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
  const [templates, setTemplates] = useState<AiTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

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
        const transformedNote = {
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
          aiSummaries: Array.isArray(data.ai_summaries)
            ? (data.ai_summaries as CommitSummary[])
            : null,
          aiOverallSummary: data.ai_overall_summary ?? null,
          templateId: data.template_id ?? null,
          branch: data.branch ?? null,
        };

        setPatchNote(transformedNote);
        setEditedContent(transformedNote.content);
        setEditedTitle(transformedNote.title);
        setSelectedTemplateId(transformedNote.templateId ?? "");
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
    const fetchTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const response = await fetch('/api/templates');
        if (!response.ok) {
          throw new Error('Failed to fetch templates');
        }
        const data = await response.json();
        setTemplates(data);
      } catch (error) {
        console.error('Error loading templates:', error);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, []);

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

  const handleRegenerateSummaries = async () => {
    if (!patchNote) return;

    const [owner, repo] = patchNote.repoName.split('/');

    if (!owner || !repo) {
      alert('Unable to determine repository owner and name for regeneration.');
      return;
    }

    setIsRegenerating(true);
    setRegenerateError(null);

    try {
      const response = await fetch('/api/github/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo,
          timePeriod: patchNote.timePeriod,
          branch: patchNote.branch || 'main',
          templateId: selectedTemplateId || null,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json();
        throw new Error(errorPayload.error || 'Failed to regenerate summaries');
      }

      const summaryData = await response.json();
      const aiSummaries = (summaryData.summaries || []) as CommitSummary[];
      const aiOverallSummary = summaryData.overallSummary || null;
      const patchNoteContent = summaryData.patchNoteContent
        ? summaryData.patchNoteContent
        : formatPatchNoteContentFromSummaries(
            aiOverallSummary,
            aiSummaries,
            patchNote.content
          );

      const updateResponse = await fetch(`/api/patch-notes/${patchNote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: patchNote.title,
          content: patchNoteContent,
          repo_name: patchNote.repoName,
          repo_url: patchNote.repoUrl,
          time_period: patchNote.timePeriod,
          changes: patchNote.changes,
          contributors: patchNote.contributors,
          ai_summaries: aiSummaries,
          ai_overall_summary: aiOverallSummary,
          template_id: selectedTemplateId || null,
          branch: patchNote.branch,
        }),
      });

      if (!updateResponse.ok) {
        const payload = await updateResponse.json();
        throw new Error(payload.error || 'Failed to save regenerated summary');
      }

      setPatchNote((current) =>
        current
          ? {
              ...current,
              content: patchNoteContent,
              aiSummaries,
              aiOverallSummary,
              templateId: selectedTemplateId || null,
            }
          : current
      );
      setEditedContent(patchNoteContent);
    } catch (error) {
      console.error('Error regenerating summaries:', error);
      setRegenerateError(
        error instanceof Error ? error.message : 'Failed to regenerate summaries'
      );
    } finally {
      setIsRegenerating(false);
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

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Summary template</CardTitle>
            <CardDescription>
              Choose a template to regenerate this patch note in different voices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex-1">
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                  disabled={isLoadingTemplates || isRegenerating}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        isLoadingTemplates
                          ? 'Loading templates...'
                          : 'Default summary style'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    <SelectItem value="">Default summary style</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} · {template.audience}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-2 text-xs text-muted-foreground">
                  {activeTemplate?.description
                    ? activeTemplate.description
                    : 'Use the built-in balanced template when no custom option is selected.'}
                </p>
              </div>
              <div className="flex flex-col gap-2 md:w-auto">
                <Button
                  type="button"
                  onClick={handleRegenerateSummaries}
                  disabled={isRegenerating || isLoadingTemplates}
                >
                  {isRegenerating ? (
                    <>
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      Recomputing...
                    </>
                  ) : (
                    <>
                      <RefreshCwIcon className="mr-2 h-4 w-4" />
                      Regenerate summary
                    </>
                  )}
                </Button>
                {regenerateError ? (
                  <p className="text-xs text-destructive">{regenerateError}</p>
                ) : null}
              </div>
            </div>

            {activeTemplate?.exampleInput && activeTemplate?.exampleOutput ? (
              <div className="grid gap-3 rounded-md border bg-muted/30 p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Example Input
                </p>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {activeTemplate.exampleInput}
                </p>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Example Output
                </p>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {activeTemplate.exampleOutput}
                </p>
              </div>
            ) : null}
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
