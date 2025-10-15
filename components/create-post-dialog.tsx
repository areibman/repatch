"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusIcon, Loader2Icon } from "lucide-react";
import {
  generateVideoData,
  generateVideoDataFromAI,
  parseGitHubUrl,
  generateBoilerplateContent,
} from "@/lib/github";
import { AiTemplate } from "@/types/ai-template";
import { formatPatchNoteContentFromSummaries } from "@/lib/patch-note-format";
import { CommitSummary } from "@/lib/ai-summarizer";

export function CreatePostDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [isFetchingBranches, setIsFetchingBranches] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [branches, setBranches] = useState<{ name: string; protected: boolean }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [timePeriod, setTimePeriod] = useState<'1day' | '1week' | '1month'>('1week');
  const [templates, setTemplates] = useState<AiTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  useEffect(() => {
    if (!open || templates.length > 0 || isLoadingTemplates) {
      return;
    }

    const fetchTemplates = async () => {
      setIsLoadingTemplates(true);
      setTemplateError(null);
      try {
        const response = await fetch('/api/templates');
        if (!response.ok) {
          throw new Error('Failed to fetch templates');
        }
        const data = await response.json();
        setTemplates(data);
      } catch (error) {
        console.error('Error fetching templates:', error);
        setTemplateError(
          error instanceof Error ? error.message : 'Unable to load templates'
        );
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, [open, templates.length, isLoadingTemplates]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const handleRepoUrlChange = async (url: string) => {
    setRepoUrl(url);
    setBranches([]);
    setSelectedBranch('');

    const repoInfo = parseGitHubUrl(url);
    if (repoInfo) {
      setIsFetchingBranches(true);
      try {
        // Call server-side API route to fetch branches
        const response = await fetch(
          `/api/github/branches?owner=${encodeURIComponent(repoInfo.owner)}&repo=${encodeURIComponent(repoInfo.repo)}`
        );
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to fetch branches');
        }
        
        const fetchedBranches = await response.json();
        setBranches(fetchedBranches);
        
        // Auto-select main/master branch if available
        const defaultBranch = fetchedBranches.find((b: { name: string; protected: boolean }) => b.name === 'main') || 
                             fetchedBranches.find((b: { name: string; protected: boolean }) => b.name === 'master') ||
                             fetchedBranches[0];
        if (defaultBranch) {
          setSelectedBranch(defaultBranch.name);
        }
      } catch (error) {
        console.error('Error fetching branches:', error);
        // Continue without branches - will be validated on submit
      } finally {
        setIsFetchingBranches(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const repoInfo = parseGitHubUrl(repoUrl);
    if (!repoInfo) {
      alert("Please enter a valid GitHub repository URL");
      return;
    }

    if (!selectedBranch) {
      alert('Please select a branch');
      return;
    }

    setIsLoading(true);

    try {
      // Fetch real GitHub statistics via API route (server-side with token)
      setLoadingStep('📊 Fetching repository statistics...');
      const statsResponse = await fetch(
        `/api/github/stats?owner=${encodeURIComponent(repoInfo.owner)}&repo=${encodeURIComponent(repoInfo.repo)}&timePeriod=${timePeriod}&branch=${encodeURIComponent(selectedBranch)}`
      );
      
      if (!statsResponse.ok) {
        const error = await statsResponse.json();
        throw new Error(error.error || 'Failed to fetch repository stats');
      }
      
      const stats = await statsResponse.json();

      // Generate AI summaries for commits
      setLoadingStep('Analyzing commits (30-60s)...');
      console.log('Fetching AI summaries...');
      const summariesResponse = await fetch('/api/github/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          timePeriod,
          branch: selectedBranch,
          templateId: selectedTemplateId || null,
        }),
      });

      let aiSummaries: CommitSummary[] = [];
      let aiOverallSummary = null;
      let aiPatchNoteContent = '';

      if (summariesResponse.ok) {
        const summaryData = await summariesResponse.json();
        aiSummaries = summaryData.summaries || [];
        aiOverallSummary = summaryData.overallSummary || null;
        aiPatchNoteContent = summaryData.patchNoteContent || '';
        console.log('AI summaries generated:', aiSummaries.length, 'commits summarized');
      } else {
        console.warn('Failed to generate AI summaries, continuing without them');
      }

      // Use AI summary as content, or fallback to boilerplate
      setLoadingStep('✍️ Generating patch note content...');
      const fallbackContent = generateBoilerplateContent(
        `${repoInfo.owner}/${repoInfo.repo}`,
        timePeriod,
        stats
      );

      const content = aiPatchNoteContent
        ? aiPatchNoteContent
        : formatPatchNoteContentFromSummaries(
            aiOverallSummary,
            aiSummaries,
            fallbackContent
          );

      // Generate video data - use AI summaries if available, otherwise fallback to raw stats
      console.log(`🎬 Generating video data using ${aiSummaries.length > 0 ? 'AI summaries' : 'raw GitHub stats'}`);
      const videoData = aiSummaries.length > 0
        ? generateVideoDataFromAI(aiSummaries, aiOverallSummary || undefined)
        : await generateVideoData(
            `${repoInfo.owner}/${repoInfo.repo}`,
            timePeriod,
            stats
          );

      const periodLabel =
        timePeriod === "1day"
          ? "Daily"
          : timePeriod === "1week"
          ? "Weekly"
          : "Monthly";

      // Create the patch note with real data and AI summaries
      setLoadingStep('💾 Saving patch note...');
      const response = await fetch("/api/patch-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo_name: `${repoInfo.owner}/${repoInfo.repo}`,
          repo_url: repoUrl,
          time_period: timePeriod,
          title: `${periodLabel} Update - ${repoInfo.repo}`,
          content: content,
          changes: {
            added: stats.additions,
            modified: 0, // GitHub API doesn't distinguish modified from additions
            removed: stats.deletions,
          },
          contributors: stats.contributors,
          video_data: videoData,
          ai_summaries: aiSummaries,
          ai_overall_summary: aiOverallSummary,
          template_id: selectedTemplateId || null,
          branch: selectedBranch,
          generated_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create patch note");
      }

      const data = await response.json();

      // Close modal and redirect to the new post
      setOpen(false);
      setRepoUrl('');
      setBranches([]);
      setSelectedBranch('');
      setLoadingStep('');
      router.push(`/blog/${data.id}`);
      router.refresh();
    } catch (error) {
      console.error("Error creating patch note:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create patch note";
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <PlusIcon className="h-5 w-5 mr-2" />
          Create New Post
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Patch Note</DialogTitle>
            <DialogDescription>
              Generate AI-powered patch notes from a GitHub repository.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="repo-url">Repository URL</Label>
              <Input
                id="repo-url"
                placeholder="https://github.com/owner/repository"
                value={repoUrl}
                onChange={(e) => handleRepoUrlChange(e.target.value)}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {isFetchingBranches ? 'Fetching branches...' : 'Enter the full GitHub repository URL'}
              </p>
            </div>

            {branches.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="branch">
                  Branch
                </Label>
                <Select
                  value={selectedBranch}
                  onValueChange={setSelectedBranch}
                  disabled={isLoading || isFetchingBranches}
                >
                  <SelectTrigger id="branch">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {branches.map((branch) => (
                      <SelectItem key={branch.name} value={branch.name}>
                        {branch.name}
                        {branch.protected && ' 🔒'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {branches.length > 0 && `${branches.length} branch${branches.length !== 1 ? 'es' : ''} found. `}
                  Select which branch to analyze
                </p>
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="time-period">Time Period</Label>
              <Select
                value={timePeriod}
                onValueChange={(value: string) =>
                  setTimePeriod(value as "1day" | "1week" | "1month")
                }
                disabled={isLoading}
              >
                <SelectTrigger id="time-period">
                  <SelectValue placeholder="Select time period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1day">Last 24 Hours</SelectItem>
                  <SelectItem value="1week">Last Week</SelectItem>
                  <SelectItem value="1month">Last Month</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose the time range for analyzing changes
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template">Summary Template</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
                disabled={isLoading || isLoadingTemplates}
              >
                <SelectTrigger id="template">
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
              {templateError ? (
                <p className="text-xs text-destructive">{templateError}</p>
              ) : selectedTemplate ? (
                <div className="rounded-md border bg-muted/30 p-3 text-xs leading-relaxed">
                  <p className="text-sm font-medium text-foreground">
                    {selectedTemplate.name}
                  </p>
                  {selectedTemplate.description ? (
                    <p className="text-muted-foreground mt-1">
                      {selectedTemplate.description}
                    </p>
                  ) : null}
                  <p className="mt-2 font-semibold uppercase tracking-wide text-muted-foreground">
                    Audience: {selectedTemplate.audience}
                  </p>
                  {selectedTemplate.exampleInput && selectedTemplate.exampleOutput ? (
                    <div className="mt-3 grid gap-2">
                      <div className="rounded border bg-background p-2">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                          Example Input
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">
                          {selectedTemplate.exampleInput}
                        </p>
                      </div>
                      <div className="rounded border bg-background p-2">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                          Example Output
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">
                          {selectedTemplate.exampleOutput}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading || isFetchingBranches}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || isFetchingBranches || !selectedBranch}
              className="min-w-[200px]"
            >
              {isLoading ? (
                <>
                  <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                  <span className="text-sm">{loadingStep || 'Processing...'}</span>
                </>
              ) : isFetchingBranches ? (
                <>
                  <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                  Loading branches...
                </>
              ) : (
                "Create Patch Note"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
