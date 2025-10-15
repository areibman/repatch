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
import { DEFAULT_TEMPLATE_EXAMPLES, formatTemplateAudience } from "@/lib/templates";
import type { AiTemplate } from "@/types/ai-template";

const DEFAULT_TEMPLATE_OPTION = "__default__";

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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
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
        if (data.length > 0) {
          setSelectedTemplateId((current) => current ?? data[0].id);
        }
      } catch (error) {
        console.error('Error loading templates:', error);
        setTemplateError(
          error instanceof Error ? error.message : 'Failed to load templates'
        );
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const previewExamples = useMemo(
    () => selectedTemplate?.examples || DEFAULT_TEMPLATE_EXAMPLES,
    [selectedTemplate]
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
          templateId: selectedTemplateId || undefined,
        }),
      });

      let aiSummaries = [];
      let aiOverallSummary = null;
      
      if (summariesResponse.ok) {
        const summaryData = await summariesResponse.json();
        aiSummaries = summaryData.summaries || [];
        aiOverallSummary = summaryData.overallSummary || null;
        console.log('AI summaries generated:', aiSummaries.length, 'commits summarized');
      } else {
        console.warn('Failed to generate AI summaries, continuing without them');
      }

      // Use AI summary as content, or fallback to boilerplate
      setLoadingStep('✍️ Generating patch note content...');
      const sectionHeading = previewExamples.sectionHeading || 'Key Changes';
      const content = aiOverallSummary
        ? `${aiOverallSummary}\n\n## ${sectionHeading}\n\n${aiSummaries.map((s: any) => `### ${s.message.split('\n')[0]}\n${s.aiSummary}\n\n**Changes:** +${s.additions} -${s.deletions} lines`).join('\n\n')}`
        : generateBoilerplateContent(
            `${repoInfo.owner}/${repoInfo.repo}`,
            timePeriod,
            stats
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
          repo_branch: selectedBranch,
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
          ai_template_id: selectedTemplateId,
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
              <Label htmlFor="summary-template">Summary Template</Label>
              <Select
                value={selectedTemplateId ?? DEFAULT_TEMPLATE_OPTION}
                onValueChange={(value) =>
                  setSelectedTemplateId(
                    value === DEFAULT_TEMPLATE_OPTION ? null : value
                  )
                }
                disabled={isLoading || isLoadingTemplates}
              >
                <SelectTrigger
                  id="summary-template"
                  data-testid="template-select"
                >
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_TEMPLATE_OPTION}>
                    System Default · technical
                  </SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.audience
                        ? ` · ${formatTemplateAudience(template.audience)}`
                        : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {templateError
                  ? `Error loading templates: ${templateError}`
                  : isLoadingTemplates
                  ? 'Loading templates...'
                  : 'Preview shows how the AI summary will read.'}
              </p>
              <div
                className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm"
                data-testid="template-preview"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {selectedTemplate?.name || 'System Default'}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {formatTemplateAudience(selectedTemplate?.audience)}
                  </span>
                </div>
                <p className="text-muted-foreground leading-snug">
                  {selectedTemplate?.description ||
                    'Balanced tone with concise technical highlights.'}
                </p>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    {previewExamples.sectionHeading}
                  </p>
                  {previewExamples.overview ? (
                    <p className="mt-1 leading-snug">
                      {previewExamples.overview}
                    </p>
                  ) : null}
                </div>
                {previewExamples.commits?.length ? (
                  <ul className="mt-2 space-y-1 list-disc pl-5">
                    {previewExamples.commits.slice(0, 2).map((example, index) => (
                      <li key={`${example.summary}-${index}`}>
                        {example.title ? (
                          <span className="font-medium">{example.title}: </span>
                        ) : null}
                        {example.summary}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
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
