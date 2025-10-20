"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusIcon, Loader2Icon } from "lucide-react";
import {
  describeFilterSelection,
  generateVideoData,
  generateVideoDataFromAI,
  parseGitHubUrl,
  generateBoilerplateContent,
  HistoryFilters,
  TimeSelection,
  GitHubRelease,
} from "@/lib/github";

export function CreatePostDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [isFetchingBranches, setIsFetchingBranches] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [branches, setBranches] = useState<{ name: string; protected: boolean }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [timeSelection, setTimeSelection] = useState<TimeSelection>('1week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [availableReleases, setAvailableReleases] = useState<GitHubRelease[]>([]);
  const [baseRelease, setBaseRelease] = useState('');
  const [targetRelease, setTargetRelease] = useState('');
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [includeSelectValue, setIncludeSelectValue] = useState('');
  const [excludeSelectValue, setExcludeSelectValue] = useState('');

  const handleRepoUrlChange = async (url: string) => {
    setRepoUrl(url);
    setBranches([]);
    setSelectedBranch('');
    setAvailableTags([]);
    setIncludeTags([]);
    setExcludeTags([]);
    setAvailableReleases([]);
    setBaseRelease('');
    setTargetRelease('');
    setFiltersError(null);
    setCustomStart('');
    setCustomEnd('');
    setIncludeSelectValue('');
    setExcludeSelectValue('');
    setTimeSelection('1week');

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

        const [tagsResponse, releasesResponse] = await Promise.all([
          fetch(
            `/api/github/tags?owner=${encodeURIComponent(repoInfo.owner)}&repo=${encodeURIComponent(repoInfo.repo)}`
          ),
          fetch(
            `/api/github/releases?owner=${encodeURIComponent(repoInfo.owner)}&repo=${encodeURIComponent(repoInfo.repo)}`
          ),
        ]);

        if (tagsResponse.ok) {
          const tags = await tagsResponse.json();
          setAvailableTags(Array.isArray(tags) ? tags : []);
        } else {
          console.warn('Failed to fetch repository tags');
        }

        if (releasesResponse.ok) {
          const releases = await releasesResponse.json();
          setAvailableReleases(Array.isArray(releases) ? releases : []);
        } else {
          console.warn('Failed to fetch repository releases');
        }
      } catch (error) {
        console.error('Error fetching branches:', error);
        // Continue without branches - will be validated on submit
      } finally {
        setIsFetchingBranches(false);
      }
    }
  };

  const validateFilters = () => {
    if (includeTags.some((tag) => excludeTags.includes(tag))) {
      return 'A tag cannot be both included and excluded.';
    }

    if (timeSelection === 'custom') {
      if (!customStart || !customEnd) {
        return 'Select both start and end dates for the custom range.';
      }

      const startDate = new Date(customStart);
      const endDate = new Date(customEnd);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return 'Provide valid start and end dates.';
      }

      if (startDate > endDate) {
        return 'The start date must be before the end date.';
      }
    }

    if (timeSelection === 'release') {
      if (availableReleases.length < 2) {
        return 'This repository does not have enough releases to compare yet.';
      }
      if (!baseRelease || !targetRelease) {
        return 'Select both a base release and a comparison release.';
      }

      if (baseRelease === targetRelease) {
        return 'Choose two different releases to compare.';
      }
    }

    return null;
  };

  const buildFilters = (): HistoryFilters => {
    const filters: HistoryFilters = {};

    if (includeTags.length) {
      filters.includeTags = includeTags;
    }
    if (excludeTags.length) {
      filters.excludeTags = excludeTags;
    }

    if (timeSelection === 'custom') {
      const startIso = new Date(`${customStart}T00:00:00Z`).toISOString();
      const endIso = new Date(`${customEnd}T23:59:59Z`).toISOString();
      filters.customRange = { since: startIso, until: endIso };
    } else if (timeSelection === 'release') {
      filters.releaseRange = { base: baseRelease, head: targetRelease };
    } else {
      filters.preset = timeSelection;
    }

    return filters;
  };

  const handleIncludeTagAdd = (tag: string) => {
    if (!tag) return;
    setFiltersError(null);
    setIncludeTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setExcludeTags((prev) => prev.filter((value) => value !== tag));
  };

  const handleExcludeTagAdd = (tag: string) => {
    if (!tag) return;
    setFiltersError(null);
    setExcludeTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setIncludeTags((prev) => prev.filter((value) => value !== tag));
  };

  const removeIncludeTag = (tag: string) => {
    setFiltersError(null);
    setIncludeTags((prev) => prev.filter((value) => value !== tag));
  };

  const removeExcludeTag = (tag: string) => {
    setFiltersError(null);
    setExcludeTags((prev) => prev.filter((value) => value !== tag));
  };

  const releaseDateFormatter = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formatReleaseLabel = (release: GitHubRelease) => {
    const name = release.name || release.tag_name;
    const dateLabel = release.published_at
      ? releaseDateFormatter.format(new Date(release.published_at))
      : 'Unreleased';
    return `${name} • ${dateLabel}`;
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

    const validationMessage = validateFilters();
    if (validationMessage) {
      setFiltersError(validationMessage);
      return;
    }

    setFiltersError(null);
    setIsLoading(true);

    try {
      const filters = buildFilters();
      const filterLabel = describeFilterSelection(filters);
      // Fetch real GitHub statistics via API route (server-side with token)
      setLoadingStep('📊 Fetching repository statistics...');
      const statsParams = new URLSearchParams({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        branch: selectedBranch,
      });

      if (filters.preset) {
        statsParams.set('preset', filters.preset);
      }
      if (filters.customRange) {
        statsParams.set('since', filters.customRange.since);
        statsParams.set('until', filters.customRange.until);
      }
      if (filters.releaseRange) {
        statsParams.set('baseRelease', filters.releaseRange.base);
        statsParams.set('headRelease', filters.releaseRange.head);
      }
      if (filters.includeTags?.length) {
        statsParams.set('includeTags', filters.includeTags.join(','));
      }
      if (filters.excludeTags?.length) {
        statsParams.set('excludeTags', filters.excludeTags.join(','));
      }

      const statsResponse = await fetch(`/api/github/stats?${statsParams.toString()}`);

      if (!statsResponse.ok) {
        const error = await statsResponse.json();
        throw new Error(error.error || 'Failed to fetch repository stats');
      }

      const stats = await statsResponse.json();

      // Generate AI summaries for commits
      setLoadingStep('Analyzing commits (30-60s)...');
      console.log('Fetching AI summaries...');
      const summarizePayload: Record<string, unknown> = {
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        branch: selectedBranch,
        filters,
      };

      if (filters.preset) {
        summarizePayload.timePeriod = filters.preset;
      }

      const summariesResponse = await fetch('/api/github/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(summarizePayload),
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
      const content = aiOverallSummary
        ? `${aiOverallSummary}\n\n## Key Changes\n\n${aiSummaries.map((s: any) => `### ${s.message.split('\n')[0]}\n${s.aiSummary}\n\n**Changes:** +${s.additions} -${s.deletions} lines`).join('\n\n')}`
        : generateBoilerplateContent(
            `${repoInfo.owner}/${repoInfo.repo}`,
            filters,
            stats
          );

      // Generate video data - use AI summaries if available, otherwise fallback to raw stats
      console.log(`🎬 Generating video data using ${aiSummaries.length > 0 ? 'AI summaries' : 'raw GitHub stats'}`);
      const videoData = aiSummaries.length > 0
        ? generateVideoDataFromAI(aiSummaries, aiOverallSummary || undefined)
        : await generateVideoData(
            `${repoInfo.owner}/${repoInfo.repo}`,
            filters,
            stats
          );

      const timePeriodForDb: '1day' | '1week' | '1month' | 'custom' | 'release' =
        timeSelection === 'custom'
          ? 'custom'
          : timeSelection === 'release'
          ? 'release'
          : timeSelection;

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
          time_period: timePeriodForDb,
          filter_metadata: filters,
          title: `${filterLabel} - ${repoInfo.repo}`,
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
      setAvailableTags([]);
      setIncludeTags([]);
      setExcludeTags([]);
      setAvailableReleases([]);
      setBaseRelease('');
      setTargetRelease('');
      setFiltersError(null);
      setCustomStart('');
      setCustomEnd('');
      setIncludeSelectValue('');
      setExcludeSelectValue('');
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
              <Label htmlFor="time-selection">Change Window</Label>
              <Select
                value={timeSelection}
                onValueChange={(value: string) => {
                  setTimeSelection(value as TimeSelection);
                  setFiltersError(null);
                }}
                disabled={isLoading}
              >
                <SelectTrigger id="time-selection">
                  <SelectValue placeholder="Select change window" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1day">Last 24 Hours</SelectItem>
                  <SelectItem value="1week">Last Week</SelectItem>
                  <SelectItem value="1month">Last Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                  <SelectItem value="release" disabled={availableReleases.length < 2}>
                    Compare Releases
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Use presets or define a custom window for commit analysis.
              </p>
              {timeSelection === 'custom' && (
                <div className="grid gap-3 pt-1 sm:grid-cols-2">
                  <div className="grid gap-1">
                    <Label htmlFor="custom-start">Start date</Label>
                    <Input
                      id="custom-start"
                      type="date"
                      value={customStart}
                      onChange={(event) => {
                        setCustomStart(event.target.value);
                        setFiltersError(null);
                      }}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="custom-end">End date</Label>
                    <Input
                      id="custom-end"
                      type="date"
                      value={customEnd}
                      onChange={(event) => {
                        setCustomEnd(event.target.value);
                        setFiltersError(null);
                      }}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}
              {timeSelection === 'release' && (
                <div className="grid gap-3 pt-1">
                  {availableReleases.length < 2 ? (
                    <p className="text-xs text-muted-foreground">
                      This repository does not have enough releases to compare yet.
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-1">
                        <Label htmlFor="base-release">Base release</Label>
                        <Select
                          value={baseRelease}
                          onValueChange={(value) => {
                            setBaseRelease(value);
                            setFiltersError(null);
                          }}
                          disabled={isLoading}
                        >
                          <SelectTrigger id="base-release">
                            <SelectValue placeholder="Select starting release" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableReleases.map((release) => (
                              <SelectItem key={`base-${release.tag_name}`} value={release.tag_name}>
                                {formatReleaseLabel(release)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="target-release">Compare to</Label>
                        <Select
                          value={targetRelease}
                          onValueChange={(value) => {
                            setTargetRelease(value);
                            setFiltersError(null);
                          }}
                          disabled={isLoading}
                        >
                          <SelectTrigger id="target-release">
                            <SelectValue placeholder="Select comparison release" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableReleases
                              .filter((release) => release.tag_name !== baseRelease)
                              .map((release) => (
                                <SelectItem key={`target-${release.tag_name}`} value={release.tag_name}>
                                  {formatReleaseLabel(release)}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Commits between the selected releases will be summarized.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {availableTags.length > 0 && (
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label>Git tag filters</Label>
                  <span className="text-xs text-muted-foreground">
                    optional
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Include or exclude commits associated with specific git tags.
                </p>
                <div className="grid gap-3">
                  <div className="grid gap-1">
                    <span className="text-sm font-medium">Include tags</span>
                    <Select
                      value={includeSelectValue}
                      onValueChange={(value) => {
                        setIncludeSelectValue(value);
                        handleIncludeTagAdd(value);
                        setIncludeSelectValue('');
                      }}
                      disabled={isLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Add tag to include" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTags
                          .filter((tag) => !includeTags.includes(tag))
                          .map((tag) => (
                            <SelectItem key={`include-${tag}`} value={tag}>
                              {tag}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {includeTags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {includeTags.map((tag) => (
                          <Badge key={`include-badge-${tag}`} variant="secondary" className="gap-1">
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeIncludeTag(tag)}
                              className="rounded-full px-1 text-xs hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              aria-label={`Remove include tag ${tag}`}
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No tags selected.</p>
                    )}
                  </div>
                  <div className="grid gap-1">
                    <span className="text-sm font-medium">Exclude tags</span>
                    <Select
                      value={excludeSelectValue}
                      onValueChange={(value) => {
                        setExcludeSelectValue(value);
                        handleExcludeTagAdd(value);
                        setExcludeSelectValue('');
                      }}
                      disabled={isLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Add tag to exclude" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTags
                          .filter((tag) => !excludeTags.includes(tag))
                          .map((tag) => (
                            <SelectItem key={`exclude-${tag}`} value={tag}>
                              {tag}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {excludeTags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {excludeTags.map((tag) => (
                          <Badge key={`exclude-badge-${tag}`} variant="outline" className="gap-1">
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeExcludeTag(tag)}
                              className="rounded-full px-1 text-xs hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              aria-label={`Remove exclude tag ${tag}`}
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No tags excluded.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {filtersError && (
              <p className="text-sm text-destructive">{filtersError}</p>
            )}
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
