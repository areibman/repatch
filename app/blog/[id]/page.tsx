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
import { PatchNote } from "@/types/patch-note";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiTemplate } from "@/types/ai-template";
import {
  buildPatchNoteContent,
  describeTemplateForPreview,
  fromApiTemplate,
} from "@/lib/ai-template";

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
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [hasFetchedTemplates, setHasFetchedTemplates] = useState(false);

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
          repoBranch: data.repo_branch,
          timePeriod: data.time_period,
          generatedAt: new Date(data.generated_at),
          title: data.title,
          content: data.content,
          changes: data.changes,
          contributors: data.contributors,
          videoUrl: data.video_url,
          videoData: data.video_data,
          aiSummaries: Array.isArray(data.ai_summaries)
            ? (data.ai_summaries as PatchNote["aiSummaries"])
            : [],
          aiOverallSummary: data.ai_overall_summary,
          aiTemplateId: data.ai_template_id,
          aiTemplate: data.ai_template
            ? fromApiTemplate(data.ai_template)
            : null,
        };

        setPatchNote(transformedNote);
        setEditedContent(transformedNote.content);
        setEditedTitle(transformedNote.title);
        setSelectedTemplateId(transformedNote.aiTemplateId || "");
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
    if (hasFetchedTemplates || isLoadingTemplates) {
      return;
    }

    const loadTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const response = await fetch('/api/ai-templates');
        if (!response.ok) {
          throw new Error('Failed to load templates');
        }

        const data = await response.json();
        const parsed: AiTemplate[] = (data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          audience: item.audience,
          commitPrompt: item.commitPrompt,
          overallPrompt: item.overallPrompt,
          examples: item.examples,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        }));

        setTemplates(parsed);
      } catch (error) {
        console.error('Error loading templates:', error);
      } finally {
        setIsLoadingTemplates(false);
        setHasFetchedTemplates(true);
      }
    };

    void loadTemplates();
  }, [hasFetchedTemplates, isLoadingTemplates]);

  useEffect(() => {
    if (patchNote?.aiTemplateId) {
      setSelectedTemplateId(patchNote.aiTemplateId);
    }
  }, [patchNote?.aiTemplateId]);

  useEffect(() => {
    if (!patchNote?.aiTemplate) {
      return;
    }

    setTemplates((current) => {
      if (current.some((template) => template.id === patchNote.aiTemplate?.id)) {
        return current;
      }

      return [...current, patchNote.aiTemplate!];
    });
  }, [patchNote?.aiTemplate]);

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) {
      return null;
    }

    return templates.find((template) => template.id === selectedTemplateId) ?? patchNote?.aiTemplate ?? null;
  }, [selectedTemplateId, templates, patchNote?.aiTemplate]);

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
          repo_branch: patchNote?.repoBranch,
          time_period: patchNote?.timePeriod,
          changes: patchNote?.changes,
          contributors: patchNote?.contributors,
          ai_summaries: patchNote?.aiSummaries,
          ai_overall_summary: patchNote?.aiOverallSummary,
          ai_template_id: patchNote?.aiTemplateId ?? null,
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
    if (!patchNote) {
      return;
    }

    const [owner, repo] = patchNote.repoName.split('/');
    if (!owner || !repo) {
      alert('Unable to determine repository owner and name.');
      return;
    }

    setIsRegenerating(true);

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
          branch: patchNote.repoBranch,
          templateId: selectedTemplate ? selectedTemplate.id : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to regenerate summaries');
      }

      const summaryData = await response.json();
      const aiSummaries = (summaryData.summaries || []) as PatchNote["aiSummaries"];
      const aiOverallSummary = (summaryData.overallSummary || null) as string | null;

      if (!aiOverallSummary) {
        throw new Error('Summaries did not return an overall overview');
      }

      const content = buildPatchNoteContent(
        aiOverallSummary,
        aiSummaries,
        selectedTemplate
      );

      const updateResponse = await fetch(`/api/patch-notes/${patchNote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          ai_summaries: aiSummaries,
          ai_overall_summary: aiOverallSummary,
          ai_template_id: selectedTemplate ? selectedTemplate.id : null,
        }),
      });

      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        throw new Error(error.error || 'Failed to save regenerated summaries');
      }

      const updatedData = await updateResponse.json();

      const updatedTemplate: AiTemplate | null = updatedData.ai_template
        ? fromApiTemplate(updatedData.ai_template)
        : null;

      setPatchNote({
        ...patchNote,
        content,
        aiSummaries,
        aiOverallSummary,
        aiTemplateId: updatedData.ai_template_id,
        aiTemplate: updatedTemplate,
      });
      setEditedContent(content);
      setSelectedTemplateId(updatedData.ai_template_id || '');

      alert('✅ Summaries regenerated successfully!');
    } catch (error) {
      console.error('Error regenerating summaries:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate summaries';
      alert(`❌ Error: ${errorMessage}`);
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
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Summary template
                </p>
                <div className="mt-2 max-w-xs">
                  <Select
                    value={selectedTemplateId}
                    onValueChange={setSelectedTemplateId}
                    disabled={
                      isLoadingTemplates ||
                      isRegenerating ||
                      (templates.length === 0 && !patchNote?.aiTemplate)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          templates.length === 0
                            ? 'Default (concise technical)'
                            : 'Select a template'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Default (concise technical)</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} · {template.audience}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="mt-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground whitespace-pre-line">
                    {selectedTemplate
                      ? describeTemplateForPreview(selectedTemplate)
                      : 'Default summaries focus on concise, technical context.'}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Button
                  variant="secondary"
                  onClick={handleRegenerateSummaries}
                  disabled={
                    isRegenerating ||
                    isLoadingTemplates ||
                    !patchNote ||
                    isEditing
                  }
                >
                  {isRegenerating ? (
                    <>
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Regenerate summary'
                  )}
                </Button>
              </div>
            </div>
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
