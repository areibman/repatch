"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, KeyboardEvent, SetStateAction } from "react";
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
import { PlusIcon, Loader2Icon, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  parseGitHubUrl,
  generateBoilerplateContent,
} from "@/lib/github";
import type { AiTemplate } from "@/types/ai-template";

const DEFAULT_TEMPLATE_OPTION = "__default__";
import {
  deriveTimePeriodValue,
  formatFilterDetailLabel,
  formatFilterSummary,
  getPresetLabel,
} from "@/lib/filter-utils";
import {
  FilterMode,
  PatchNoteFilters,
  TimePreset,
} from "@/types/patch-note";

const RECENT_REPOS_KEY = 'repatch_recent_repos';
const MAX_RECENT_REPOS = 5;

interface RecentRepo {
  url: string;
  owner: string;
  repo: string;
  lastUsed: string;
}

function getRecentRepos(): RecentRepo[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_REPOS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentRepo(url: string, owner: string, repo: string) {
  if (typeof window === 'undefined') return;
  try {
    const recent = getRecentRepos();
    const existing = recent.findIndex((r) => r.url === url);
    
    // Remove if already exists
    if (existing >= 0) {
      recent.splice(existing, 1);
    }
    
    // Add to front
    recent.unshift({ url, owner, repo, lastUsed: new Date().toISOString() });
    
    // Keep only MAX_RECENT_REPOS
    const trimmed = recent.slice(0, MAX_RECENT_REPOS);
    
    localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to save recent repo:', error);
  }
}

export function CreatePostDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [isFetchingBranches, setIsFetchingBranches] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);
  const [branches, setBranches] = useState<{ name: string; protected: boolean }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [timePeriod, setTimePeriod] = useState<'1day' | '1week' | '1month'>('1week');
  const [templates, setTemplates] = useState<AiTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [includeCommitMessages, setIncludeCommitMessages] = useState(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setIsLoadingTemplates(true);
        setTemplateError(null);
        const response = await fetch('/api/ai-templates');
        if (response.status === 401) {
          setTemplates([]);
          setSelectedTemplateId(null);
          return;
        }

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

  useEffect(() => {
    if (open) {
      setRecentRepos(getRecentRepos());
    }
  }, [open]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );
  const [filterMode, setFilterMode] = useState<FilterMode>('preset');
  const [timePreset, setTimePreset] = useState<TimePreset>('1week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [availableReleases, setAvailableReleases] = useState<
    Array<{
      id: number;
      tagName: string;
      name: string | null;
      publishedAt: string | null;
      targetCommitish: string;
    }>
  >([]);
  const [selectedReleases, setSelectedReleases] = useState<string[]>([]);
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [includeLabels, setIncludeLabels] = useState<string[]>([]);
  const [excludeLabels, setExcludeLabels] = useState<string[]>([]);
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  const fetchRepositoryMetadata = async (owner: string, repo: string) => {
    setIsFetchingMetadata(true);
    try {
      const [labelsRes, tagsRes, releasesRes] = await Promise.all([
        fetch(
          `/api/github/labels?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
        ),
        fetch(
          `/api/github/tags?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
        ),
        fetch(
          `/api/github/releases?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
        ),
      ]);

      if (labelsRes.ok) {
        const labels = await labelsRes.json();
        setAvailableLabels(Array.isArray(labels) ? labels : []);
      }

      if (tagsRes.ok) {
        const tags = await tagsRes.json();
        if (Array.isArray(tags)) {
          setAvailableTags(
            tags.map((tag: { name: string }) => tag.name).filter(Boolean)
          );
        }
      }

      if (releasesRes.ok) {
        const releases = await releasesRes.json();
        if (Array.isArray(releases)) {
          setAvailableReleases(
            releases.map((release: { 
              id: number; 
              tagName?: string; 
              tag_name?: string; 
              name?: string | null;
              publishedAt?: string | null;
              published_at?: string | null;
              targetCommitish?: string;
              target_commitish?: string;
            }) => ({
              id: release.id,
              tagName: release.tagName || release.tag_name || '',
              name: release.name ?? null,
              publishedAt: release.publishedAt || release.published_at || null,
              targetCommitish: release.targetCommitish || release.target_commitish || '',
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error fetching repository metadata:', error);
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const handleRepoUrlChange = async (url: string) => {
    setRepoUrl(url);
    setBranches([]);
    setSelectedBranch('');
    setAvailableLabels([]);
    setAvailableTags([]);
    setAvailableReleases([]);
    setSelectedReleases([]);
    setIncludeLabels([]);
    setExcludeLabels([]);
    setIncludeTags([]);
    setExcludeTags([]);

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

        fetchRepositoryMetadata(repoInfo.owner, repoInfo.repo).catch((error) =>
          console.error('Error fetching metadata:', error)
        );
      } catch (error) {
        console.error('Error fetching branches:', error);
        // Continue without branches - will be validated on submit
      } finally {
        setIsFetchingBranches(false);
      }
    }
  };

  const sanitizeTokens = (values: string[]) =>
    Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

  const addToken = (
    value: string,
    setter: Dispatch<SetStateAction<string[]>>
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setter((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  };

  const removeToken = (
    value: string,
    setter: Dispatch<SetStateAction<string[]>>
  ) => {
    setter((prev) => prev.filter((item) => item !== value));
  };

  const handleTokenInput = (
    event: KeyboardEvent<HTMLInputElement>,
    setter: Dispatch<SetStateAction<string[]>>
  ) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const target = event.target as HTMLInputElement;
      const value = target.value.trim();
      if (value) {
        addToken(value, setter);
        target.value = '';
      }
    }
  };

  const toggleReleaseSelection = (tag: string) => {
    setSelectedReleases((prev) =>
      prev.includes(tag)
        ? prev.filter((value) => value !== tag)
        : [...prev, tag]
    );
  };

  const releasePreviousTagMap = useMemo(() => {
    const sorted = [...availableReleases].sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return aTime - bTime;
    });
    const map = new Map<string, string | null>();
    sorted.forEach((release, index) => {
      const previous = index > 0 ? sorted[index - 1] : undefined;
      map.set(release.tagName, previous ? previous.tagName : null);
    });
    return map;
  }, [availableReleases]);

  const renderTokenSelector = (
    label: string,
    tokens: string[],
    setter: Dispatch<SetStateAction<string[]>>,
    suggestions: string[],
    placeholder: string,
    tooltip?: string
  ) => (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium">{label}</span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[250px]">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {tokens.map((token) => (
          <Badge
            key={token}
            variant="secondary"
            className="flex items-center gap-2"
          >
            {token}
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => removeToken(token, setter)}
              aria-label={`Remove ${token}`}
            >
              ×
            </button>
          </Badge>
        ))}
        {tokens.length === 0 && (
          <span className="text-xs text-muted-foreground">None selected</span>
        )}
      </div>
      <Input
        placeholder={placeholder}
        onKeyDown={(event) => handleTokenInput(event, setter)}
        disabled={isLoading}
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Suggestions:</span>
          {suggestions.slice(0, 8).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-md border px-2 py-0.5 hover:bg-muted"
              onClick={() => addToken(suggestion, setter)}
              disabled={isLoading}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const presetOptions = useMemo(
    () =>
      (['1day', '1week', '1month'] as TimePreset[]).map((value) => ({
        value,
        label: getPresetLabel(value),
      })),
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const repoInfo = parseGitHubUrl(repoUrl);
    if (!repoInfo) {
      alert("Please enter a valid GitHub repository URL");
      return;
    }

    if (filterMode !== 'release' && !selectedBranch) {
      alert('Please select a branch');
      return;
    }

    setIsLoading(true);
    setLoadingStep('Creating patch note...');

    try {
      let filterPayload: PatchNoteFilters;
      if (filterMode === 'custom') {
        if (!customStart || !customEnd) {
          alert('Please provide both a start and end date for the custom range');
          setIsLoading(false);
          return;
        }
        const start = new Date(customStart);
        const end = new Date(customEnd);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          alert('Please enter valid dates for the custom range');
          setIsLoading(false);
          return;
        }
        if (start >= end) {
          alert('The end date must be after the start date');
          setIsLoading(false);
          return;
        }
        filterPayload = {
          mode: 'custom',
          customRange: {
            since: start.toISOString(),
            until: end.toISOString(),
          },
        };
      } else if (filterMode === 'release') {
        if (selectedReleases.length === 0) {
          alert('Select at least one release to generate patch notes from');
          setIsLoading(false);
          return;
        }
        const releases = selectedReleases
          .map((tag) => {
            const release = availableReleases.find((item) => item.tagName === tag);
            if (!release) return null;
            return {
              tag: release.tagName,
              name: release.name,
              previousTag: releasePreviousTagMap.get(release.tagName) ?? null,
              publishedAt: release.publishedAt,
              targetCommitish: release.targetCommitish,
            };
          })
          .filter(Boolean) as NonNullable<PatchNoteFilters['releases']>;

        if (releases.length === 0) {
          alert('Selected releases could not be loaded. Please refresh and try again.');
          setIsLoading(false);
          return;
        }

        filterPayload = {
          mode: 'release',
          releases,
        };
      } else {
        filterPayload = {
          mode: 'preset',
          preset: timePreset,
        };
      }

      const sanitizedIncludeLabels = sanitizeTokens(includeLabels);
      const sanitizedExcludeLabels = sanitizeTokens(excludeLabels);
      const sanitizedIncludeTags = sanitizeTokens(includeTags);
      const sanitizedExcludeTags = sanitizeTokens(excludeTags);

      if (sanitizedIncludeLabels.length > 0) {
        filterPayload.includeLabels = sanitizedIncludeLabels;
      }
      if (sanitizedExcludeLabels.length > 0) {
        filterPayload.excludeLabels = sanitizedExcludeLabels;
      }
      if (sanitizedIncludeTags.length > 0) {
        filterPayload.includeTags = sanitizedIncludeTags;
      }
      if (sanitizedExcludeTags.length > 0) {
        filterPayload.excludeTags = sanitizedExcludeTags;
      }

      const descriptor =
        filterPayload.mode === 'preset' && filterPayload.preset
          ? getPresetLabel(filterPayload.preset)
          : filterPayload.mode === 'release'
          ? 'Release Selection'
          : 'Custom Range';

      // Create a pending patch note immediately
      const response = await fetch('/api/patch-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo_name: `${repoInfo.owner}/${repoInfo.repo}`,
          repo_url: repoUrl,
          repo_branch: selectedBranch,
          time_period: deriveTimePeriodValue(filterPayload),
          title: `${descriptor} Update - ${repoInfo.repo}`,
          content: '...', // Placeholder content
          changes: {
            added: 0,
            modified: 0,
            removed: 0,
          },
          contributors: [],
          ai_template_id: selectedTemplateId,
          filter_metadata: filterPayload,
          generated_at: new Date().toISOString(),
          processing_status: 'pending',
          processing_stage: 'Queued for processing...',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create patch note');
      }

      const data = await response.json();

      // Save to recent repos
      saveRecentRepo(repoUrl, repoInfo.owner, repoInfo.repo);

      // Reset form state immediately (before navigation to prevent any flicker)
      setRepoUrl('');
      setBranches([]);
      setSelectedBranch('');
      setFilterMode('preset');
      setTimePreset('1week');
      setCustomStart('');
      setCustomEnd('');
      setAvailableLabels([]);
      setAvailableTags([]);
      setAvailableReleases([]);
      setSelectedReleases([]);
      setIncludeLabels([]);
      setExcludeLabels([]);
      setIncludeTags([]);
      setExcludeTags([]);
      setLoadingStep('');
      setIsLoading(false);

      // Close modal
      setOpen(false);

      // Navigate to the post page
      router.push(`/blog/${data.id}`);
      router.refresh();

      // Trigger background processing (don't await, handle errors silently)
      console.log(`🚀 Triggering background processing for patch note: ${data.id}`);
      fetch(`/api/patch-notes/${data.id}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          repoUrl,
          branch: selectedBranch,
          filters: filterPayload,
          templateId: selectedTemplateId,
          generateCommitTitles: includeCommitMessages,
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Background processing returned error status: ${response.status}`, errorText);
          } else {
            const result = await response.json();
            console.log('✅ Background processing initiated successfully:', result);
            
            // If content generation completed and has video data, trigger video rendering
            if (result.hasVideoData) {
              console.log('🎬 Triggering video render...');
              fetch(`/api/patch-notes/${data.id}/render-video`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              })
                .then(async (videoResponse) => {
                  if (videoResponse.ok) {
                    const videoResult = await videoResponse.json();
                    console.log('✅ Video render started:', videoResult);
                  } else {
                    console.error('❌ Video render failed to start');
                  }
                })
                .catch((err) => {
                  console.error('❌ Video render request failed:', err);
                });
            }
          }
        })
        .catch((error) => {
          // This will catch network errors, timeouts, etc.
          // The processing might still be running on the server, so we don't show an error to user
          console.error('❌ Background processing request failed (may still be processing on server):', error);
        });
    } catch (error) {
      console.error("Error creating patch note:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create patch note";
      alert(`Error: ${errorMessage}`);
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <PlusIcon className="h-5 w-5 mr-2" />
            Create New Post
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[525px] max-h-[85vh] overflow-hidden flex flex-col">
          <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden min-h-0 flex-1">
            <DialogHeader>
              <DialogTitle>Create Patch Note</DialogTitle>
              <DialogDescription>
                Generate AI-powered patch notes from a GitHub repository.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 overflow-y-auto flex-1 min-h-0">
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
              {recentRepos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {repoUrl ? 'Recent repositories (click to switch):' : 'Recent repositories:'}
                  </p>
                  <div className="flex flex-wrap gap-2 min-h-[32px]">
                    {recentRepos.map((recent) => (
                      <button
                        key={recent.url}
                        type="button"
                        onClick={() => handleRepoUrlChange(recent.url)}
                        disabled={isLoading}
                        className={`text-xs px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          repoUrl === recent.url
                            ? 'border-primary bg-primary/10 font-medium'
                            : 'border-border bg-muted hover:bg-muted/80 hover:border-foreground/20'
                        }`}
                      >
                        <span className={repoUrl === recent.url ? 'font-semibold' : 'font-medium'}>
                          {recent.owner}/{recent.repo}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {isFetchingBranches
                  ? 'Fetching branches...'
                  : isFetchingMetadata
                  ? 'Loading releases, labels, and tags from GitHub...'
                  : 'Enter the full GitHub repository URL'}
              </p>
            </div>

            {filterMode !== 'release' && (
              <div className="grid gap-2">
                <Label htmlFor="branch">
                  Branch
                </Label>
                <Select
                  value={selectedBranch}
                  onValueChange={setSelectedBranch}
                  disabled={isLoading || isFetchingBranches || branches.length === 0}
                >
                  <SelectTrigger id="branch">
                    <SelectValue placeholder={
                      isFetchingBranches 
                        ? "Loading branches..." 
                        : branches.length === 0 
                        ? "Enter repository URL first" 
                        : "Select branch"
                    } />
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
                  {isFetchingBranches 
                    ? 'Fetching branches...'
                    : branches.length > 0 
                    ? `${branches.length} branch${branches.length !== 1 ? 'es' : ''} found. Select which branch to analyze`
                    : 'Branch selection will be available after entering a valid repository URL'}
                </p>
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="filter-mode">Commit Source</Label>
              <Select
                value={filterMode}
                onValueChange={(value: string) =>
                  setFilterMode(value as FilterMode)
                }
                disabled={isLoading}
              >
                <SelectTrigger id="filter-mode">
                  <SelectValue placeholder="Select commit source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preset">Quick Preset</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                  <SelectItem value="release">Release Selection</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose how to scope the commits that feed this patch note.
              </p>

              {filterMode === 'preset' && (
                <div className="space-y-2">
                  <Select
                    value={timePreset}
                    onValueChange={(value: string) =>
                      setTimePreset(value as TimePreset)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select preset" />
                    </SelectTrigger>
                    <SelectContent>
                      {presetOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Apply a one-click interval for recent activity.
                  </p>
                </div>
              )}

              {filterMode === 'custom' && (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Start
                      </span>
                      <Input
                        type="datetime-local"
                        value={customStart}
                        onChange={(event) => setCustomStart(event.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </div>
                    <div className="grid gap-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        End
                      </span>
                      <Input
                        type="datetime-local"
                        value={customEnd}
                        onChange={(event) => setCustomEnd(event.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Specify the exact time span to analyze commits.
                  </p>
                </div>
              )}

              {filterMode === 'release' && (
                <div className="space-y-2">
                  {availableReleases.length > 0 ? (
                    <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                      {availableReleases.map((release) => (
                        <label
                          key={release.id}
                          className="flex items-start gap-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4"
                            checked={selectedReleases.includes(release.tagName)}
                            onChange={() => toggleReleaseSelection(release.tagName)}
                            disabled={isLoading}
                          />
                          <span className="flex flex-col">
                            <span className="font-medium">
                              {release.name || release.tagName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {release.publishedAt
                                ? new Date(release.publishedAt).toLocaleDateString()
                                : 'Publish date unavailable'}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      {isFetchingMetadata
                        ? 'Loading releases from GitHub...'
                        : 'No releases detected yet for this repository.'}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Select one or more releases to use their commit ranges.
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {renderTokenSelector(
                'Include Labels',
                includeLabels,
                setIncludeLabels,
                availableLabels,
                'Add label and press Enter',
                'Only analyze commits/PRs that have at least one of these GitHub labels (e.g., "feature", "bug")'
              )}
              {renderTokenSelector(
                'Exclude Labels',
                excludeLabels,
                setExcludeLabels,
                availableLabels,
                'Exclude label and press Enter',
                'Skip commits/PRs that have any of these GitHub labels (e.g., "internal", "chore")'
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {renderTokenSelector(
                'Include Tags',
                includeTags,
                setIncludeTags,
                availableTags,
                'Add tag and press Enter',
                'Only analyze commits associated with these Git tags'
              )}
              {renderTokenSelector(
                'Exclude Tags',
                excludeTags,
                setExcludeTags,
                availableTags,
                'Exclude tag and press Enter',
                'Skip commits associated with these Git tags'
              )}
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
                  <span className="text-xs text-muted-foreground">
                    {selectedTemplate?.content?.length || 0} chars
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto prose prose-sm max-w-none whitespace-pre-wrap text-xs text-muted-foreground">
                  {selectedTemplate?.content || 'Balanced tone with concise technical highlights.'}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="include-commit-messages"
                  checked={includeCommitMessages}
                  onChange={(e) => setIncludeCommitMessages(e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label 
                  htmlFor="include-commit-messages" 
                  className="text-sm font-normal cursor-pointer"
                >
                  Include original commit messages as headers
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                When unchecked, AI will generate cleaner, more descriptive headers for each change instead of showing raw commit messages.
              </p>
            </div>
            </div>

            <DialogFooter className="pt-4">
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
                disabled={isLoading || isFetchingBranches || (filterMode !== 'release' && !selectedBranch)}
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
    </TooltipProvider>
  );
}
