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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CommitSummary, PatchNote } from "@/types/patch-note";
import type { AiTemplate } from "@/types/ai-template";
import { formatFilterDetailLabel, formatFilterSummary } from "@/lib/filter-utils";
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
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [templates, setTemplates] = useState<AiTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateMessage, setRegenerateMessage] = useState('');

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
          aiTemplateId: data.ai_template_id,
          filterMetadata: data.filter_metadata ?? null,
        };

        setPatchNote(transformedNote);
        setEditedContent(transformedNote.content);
        setEditedTitle(transformedNote.title);
        setSelectedTemplateId(transformedNote.aiTemplateId ?? null);
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

      const commitSection = summaries.length
        ? `\n\n## Key Changes\n\n${summaries
            .map(
              (s: CommitSummary) =>
                `### ${s.message.split('\n')[0]}\n${s.aiSummary}\n\n**Changes:** +${s.additions} -${s.deletions} lines`
            )
            .join('\n\n')}`
        : '';
      const newContent = overallSummary
        ? `${overallSummary}${commitSection}`
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
        `Failed to regenerate summary: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      setRegenerateMessage('');
      setIsRegenerating(false);
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
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="detail-template">Template</Label>
                <Select
                  value={selectedTemplateId ?? DEFAULT_TEMPLATE_OPTION}
                  onValueChange={(value) =>
                    setSelectedTemplateId(
                      value === DEFAULT_TEMPLATE_OPTION ? null : value
                    )
                  }
                  disabled={isRegenerating || isLoadingTemplates}
                >
                  <SelectTrigger
                    id="detail-template"
                    data-testid="detail-template-select"
                  >
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
                <p className="text-xs text-muted-foreground">
                  {templateError
                    ? `Error loading templates: ${templateError}`
                    : isLoadingTemplates
                    ? 'Loading templates...'
                    : 'Preview shows the expected tone for regenerated summaries.'}
                </p>
              </div>
              <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {selectedTemplate?.name || 'System Default'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {selectedTemplate?.content.length || 0} chars
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto prose prose-sm max-w-none whitespace-pre-wrap text-xs text-muted-foreground">
                  {selectedTemplate?.content || 'Balanced tone with concise technical highlights.'}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {patchNote.repoBranch
                ? `Generated from branch ${patchNote.repoBranch}`
                : 'Branch defaults to main'}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateSummary}
              disabled={isRegenerating || isLoadingTemplates}
              data-testid="regenerate-template-button"
            >
              {isRegenerating ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  {regenerateMessage || 'Regenerating...'}
                </>
              ) : (
                'Regenerate'
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
