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
import { getFilterSummaryLabel, validateFilterMetadata } from "@/lib/filter-metadata";
import {
  PatchNoteFilterMetadata,
  PatchNoteFilterMode,
  PatchNoteTimePreset,
} from "@/types/patch-note";

interface RepoRelease {
  tag: string;
  name: string;
  publishedAt?: string | null;
}

export function CreatePostDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [isFetchingBranches, setIsFetchingBranches] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [branches, setBranches] = useState<{ name: string; protected: boolean }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [filterMode, setFilterMode] = useState<PatchNoteFilterMode>("preset");
  const [timePreset, setTimePreset] = useState<Exclude<PatchNoteTimePreset, "custom">>("1week");
  const [customRange, setCustomRange] = useState<{ since: string; until: string }>({
    since: "",
    until: "",
  });
  const [availableReleases, setAvailableReleases] = useState<RepoRelease[]>([]);
  const [releaseHead, setReleaseHead] = useState("");
  const [releaseBase, setReleaseBase] = useState("");
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [includeLabels, setIncludeLabels] = useState<string[]>([]);
  const [excludeLabels, setExcludeLabels] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const resetFilters = () => {
    setFilterMode("preset");
    setTimePreset("1week");
    setCustomRange({ since: "", until: "" });
    setAvailableReleases([]);
    setReleaseHead("");
    setReleaseBase("");
    setAvailableLabels([]);
    setIncludeLabels([]);
    setExcludeLabels([]);
    setValidationError(null);
  };

  const handleRepoUrlChange = async (url: string) => {
    setRepoUrl(url);
    setBranches([]);
    setSelectedBranch("");
    resetFilters();

    const repoInfo = parseGitHubUrl(url);
    if (repoInfo) {
      setIsFetchingBranches(true);
      try {
        const branchesResponse = await fetch(
          `/api/github/branches?owner=${encodeURIComponent(repoInfo.owner)}&repo=${encodeURIComponent(repoInfo.repo)}`
        );

        if (!branchesResponse.ok) {
          const error = await branchesResponse.json();
          throw new Error(error.error || "Failed to fetch branches");
        }

        const fetchedBranches = await branchesResponse.json();
        setBranches(fetchedBranches);

        const defaultBranch =
          fetchedBranches.find((b: { name: string; protected: boolean }) => b.name === "main") ||
          fetchedBranches.find((b: { name: string; protected: boolean }) => b.name === "master") ||
          fetchedBranches[0];
        if (defaultBranch) {
          setSelectedBranch(defaultBranch.name);
        }

        const [labelsResponse, releasesResponse] = await Promise.all([
          fetch(
            `/api/github/labels?owner=${encodeURIComponent(repoInfo.owner)}&repo=${encodeURIComponent(repoInfo.repo)}`
          ),
          fetch(
            `/api/github/releases?owner=${encodeURIComponent(repoInfo.owner)}&repo=${encodeURIComponent(repoInfo.repo)}`
          ),
        ]);

        if (labelsResponse.ok) {
          const labels = await labelsResponse.json();
          setAvailableLabels(labels.map((label: { name: string }) => label.name));
        }

        if (releasesResponse.ok) {
          const releases = await releasesResponse.json();
          const sortedReleases = (releases as RepoRelease[]).sort((a, b) => {
            const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return bDate - aDate;
          });
          setAvailableReleases(sortedReleases);
        }
      } catch (error) {
        console.error("Error fetching repository metadata:", error);
        setValidationError(
          error instanceof Error ? error.message : "Unable to load repository metadata"
        );
      } finally {
        setIsFetchingBranches(false);
      }
    }
  };

  const toggleLabel = (label: string, type: "include" | "exclude") => {
    setValidationError(null);
    if (type === "include") {
      setIncludeLabels((prev) =>
        prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
      );
      setExcludeLabels((prev) => prev.filter((item) => item !== label));
    } else {
      setExcludeLabels((prev) =>
        prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
      );
      setIncludeLabels((prev) => prev.filter((item) => item !== label));
    }
  };

  const buildFilters = (): PatchNoteFilterMetadata => {
    const metadata: PatchNoteFilterMetadata = {
      mode: filterMode,
      includeLabels,
      excludeLabels,
      branch: selectedBranch || null,
    };

    if (filterMode === "preset") {
      metadata.preset = timePreset;
    }

    if (filterMode === "custom" && customRange.since && customRange.until) {
      metadata.customRange = {
        since: new Date(customRange.since).toISOString(),
        until: new Date(customRange.until).toISOString(),
      };
    }

    if (filterMode === "release" && releaseHead) {
      metadata.releaseRange = {
        headTag: releaseHead,
        baseTag: releaseBase ? releaseBase : null,
      };
    }

    return metadata;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const repoInfo = parseGitHubUrl(repoUrl);
    if (!repoInfo) {
      alert("Please enter a valid GitHub repository URL");
      return;
    }

    if (!selectedBranch) {
      alert("Please select a branch");
      return;
    }

    const filters = buildFilters();
    const validation = validateFilterMetadata(filters);

    if (!validation.ok) {
      setValidationError(validation.reason || "Please review the selected filters");
      return;
    }

    setValidationError(null);
    setIsLoading(true);

    try {
      setLoadingStep("📊 Fetching repository statistics...");
      const statsResponse = await fetch("/api/github/stats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          branch: selectedBranch,
          filters: validation.normalized,
        }),
      });

      if (!statsResponse.ok) {
        const error = await statsResponse.json();
        throw new Error(error.error || "Failed to fetch repository stats");
      }

      const stats = await statsResponse.json();
      const filterLabel = stats.filterLabel || getFilterSummaryLabel(validation.normalized);

      setLoadingStep("Analyzing commits (30-60s)...");
      const summariesResponse = await fetch("/api/github/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          branch: selectedBranch,
          filters: validation.normalized,
        }),
      });

      let aiSummaries: any[] = [];
      let aiOverallSummary: string | null = null;
      let effectiveFilterLabel = filterLabel;

      if (summariesResponse.ok) {
        const summaryData = await summariesResponse.json();
        aiSummaries = summaryData.summaries || [];
        aiOverallSummary = summaryData.overallSummary || null;
        if (summaryData.filterLabel) {
          effectiveFilterLabel = summaryData.filterLabel;
        }
        console.log("AI summaries generated:", aiSummaries.length, "commits summarized");
      } else {
        const error = await summariesResponse.json();
        console.warn("Failed to generate AI summaries:", error.error);
      }

      setLoadingStep("✍️ Generating patch note content...");
      const content = aiOverallSummary
        ? `${aiOverallSummary}\n\n## Key Changes\n\n${aiSummaries
            .map(
              (s: any) =>
                `### ${s.message.split("\n")[0]}\n${s.aiSummary}\n\n**Changes:** +${s.additions} -${s.deletions} lines`
            )
            .join("\n\n")}`
        : generateBoilerplateContent(
            `${repoInfo.owner}/${repoInfo.repo}`,
            effectiveFilterLabel,
            stats
          );

      console.log(
        `🎬 Generating video data using ${
          aiSummaries.length > 0 ? "AI summaries" : "raw GitHub stats"
        }`
      );
      const videoData =
        aiSummaries.length > 0
          ? generateVideoDataFromAI(aiSummaries, aiOverallSummary || undefined)
          : await generateVideoData(
              `${repoInfo.owner}/${repoInfo.repo}`,
              effectiveFilterLabel,
              stats
            );

      const storedTimePeriod: PatchNoteTimePreset =
        filterMode === "preset" ? timePreset : "custom";

      setLoadingStep("💾 Saving patch note...");
      const response = await fetch("/api/patch-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo_name: `${repoInfo.owner}/${repoInfo.repo}`,
          repo_url: repoUrl,
          time_period: storedTimePeriod,
          title: `${effectiveFilterLabel} Update - ${repoInfo.repo}`,
          content,
          changes: {
            added: stats.additions,
            modified: 0,
            removed: stats.deletions,
          },
          contributors: stats.contributors,
          video_data: videoData,
          ai_summaries: aiSummaries,
          ai_overall_summary: aiOverallSummary,
          filter_metadata: validation.normalized,
          generated_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create patch note");
      }

      const data = await response.json();

      setOpen(false);
      setRepoUrl("");
      setBranches([]);
      setSelectedBranch("");
      resetFilters();
      setLoadingStep("");
      router.push(`/blog/${data.id}`);
      router.refresh();
    } catch (error) {
      console.error("Error creating patch note:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create patch note";
      setValidationError(errorMessage);
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingStep("");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          setRepoUrl("");
          setBranches([]);
          setSelectedBranch("");
          resetFilters();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg">
          <PlusIcon className="h-5 w-5 mr-2" />
          Create New Post
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Create Patch Note</DialogTitle>
            <DialogDescription>
              Generate AI-powered patch notes from a GitHub repository with flexible filters.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
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
                {isFetchingBranches
                  ? "Fetching branches and metadata..."
                  : "Enter the full GitHub repository URL"}
              </p>
            </div>

            {branches.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="branch">Branch</Label>
                <Select
                  value={selectedBranch}
                  onValueChange={(value) => {
                    setSelectedBranch(value);
                    setValidationError(null);
                  }}
                  disabled={isLoading || isFetchingBranches}
                >
                  <SelectTrigger id="branch">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {branches.map((branch) => (
                      <SelectItem key={branch.name} value={branch.name}>
                        {branch.name}
                        {branch.protected && " 🔒"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {branches.length > 0 && `${branches.length} branch${branches.length !== 1 ? "es" : ""} found.`}
                  {" Select which branch to analyze."}
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="filter-mode">Commit source</Label>
              <Select
                value={filterMode}
                onValueChange={(value) => {
                  setFilterMode(value as PatchNoteFilterMode);
                  setValidationError(null);
                }}
                disabled={isLoading}
              >
                <SelectTrigger id="filter-mode">
                  <SelectValue placeholder="Choose how to scope commits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preset">Quick preset</SelectItem>
                  <SelectItem value="custom">Custom date range</SelectItem>
                  <SelectItem value="release">Compare releases</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pick a preset window, date range, or releases to build patch notes.
              </p>
            </div>

            {filterMode === "preset" && (
              <div className="grid gap-2">
                <Label htmlFor="time-preset">Preset interval</Label>
                <Select
                  value={timePreset}
                  onValueChange={(value) => {
                    setTimePreset(value as Exclude<PatchNoteTimePreset, "custom">);
                    setValidationError(null);
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger id="time-preset">
                    <SelectValue placeholder="Select preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1day">Last 24 hours</SelectItem>
                    <SelectItem value="1week">Last 7 days</SelectItem>
                    <SelectItem value="1month">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {filterMode === "custom" && (
              <div className="grid gap-2">
                <Label>Custom date range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <span className="text-xs text-muted-foreground">Start</span>
                    <Input
                      type="date"
                      value={customRange.since}
                      onChange={(e) => {
                        setCustomRange((prev) => ({ ...prev, since: e.target.value }));
                        setValidationError(null);
                      }}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="grid gap-1">
                    <span className="text-xs text-muted-foreground">End</span>
                    <Input
                      type="date"
                      value={customRange.until}
                      onChange={(e) => {
                        setCustomRange((prev) => ({ ...prev, until: e.target.value }));
                        setValidationError(null);
                      }}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose any two dates to define the commit window.
                </p>
              </div>
            )}

            {filterMode === "release" && (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="release-head">Target release</Label>
                  <Select
                    value={releaseHead}
                    onValueChange={(value) => {
                      setReleaseHead(value);
                      setValidationError(null);
                    }}
                    disabled={isLoading || availableReleases.length === 0}
                  >
                    <SelectTrigger id="release-head">
                      <SelectValue placeholder="Select release" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px] overflow-y-auto">
                      {availableReleases.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No releases found for this repository.
                        </div>
                      )}
                      {availableReleases.map((release) => (
                        <SelectItem key={release.tag} value={release.tag}>
                          {release.name} ({release.tag})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="release-base">Compare against</Label>
                  <Select
                    value={releaseBase}
                    onValueChange={(value) => {
                      setReleaseBase(value);
                      setValidationError(null);
                    }}
                    disabled={isLoading || availableReleases.length === 0}
                  >
                    <SelectTrigger id="release-base">
                      <SelectValue placeholder="Previous release (optional)" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px] overflow-y-auto">
                      <SelectItem value="">Previous release</SelectItem>
                      {availableReleases.map((release) => (
                        <SelectItem key={release.tag} value={release.tag}>
                          {release.name} ({release.tag})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to compare against the repository default branch.
                  </p>
                </div>
              </div>
            )}

            {availableLabels.length > 0 && (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label>Include commits with labels</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableLabels.map((label) => (
                      <label key={`include-${label}`} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={includeLabels.includes(label)}
                          onChange={() => toggleLabel(label, "include")}
                          disabled={isLoading}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Only commits tied to PRs with these labels will be considered.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>Exclude commits with labels</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableLabels.map((label) => (
                      <label key={`exclude-${label}`} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={excludeLabels.includes(label)}
                          onChange={() => toggleLabel(label, "exclude")}
                          disabled={isLoading}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Commits associated with these labels will be removed from the summary.
                  </p>
                </div>
              </div>
            )}

            {validationError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {validationError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
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
              disabled={
                isLoading ||
                isFetchingBranches ||
                !selectedBranch ||
                !repoUrl
              }
              className="min-w-[200px]"
            >
              {isLoading ? (
                <>
                  <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                  {loadingStep || "Generating..."}
                </>
              ) : (
                "Generate Patch Notes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
