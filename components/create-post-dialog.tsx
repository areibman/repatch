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
import type { RepoStatsWithContext } from "@/lib/github";
import type { PatchNoteFilters, TimePeriod, TimePreset } from "@/types/patch-note";

const PRESET_OPTIONS: Array<{ value: TimePreset; label: string }> = [
  { value: "1day", label: "1 Day" },
  { value: "1week", label: "1 Week" },
  { value: "1month", label: "1 Month" },
];

const EMPTY_RELEASE_VALUE = "__none";

type GitHubRelease = {
  id: number;
  tag_name: string;
  name: string | null;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
};

function parseTagsInput(input: string): string[] {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.replace(/^#/, ""));
}

export function CreatePostDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [isFetchingBranches, setIsFetchingBranches] = useState(false);
  const [isFetchingReleases, setIsFetchingReleases] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [branches, setBranches] = useState<{ name: string; protected: boolean }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [timePreset, setTimePreset] = useState<TimePreset>("1week");
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");
  const [includeTagsInput, setIncludeTagsInput] = useState("");
  const [excludeTagsInput, setExcludeTagsInput] = useState("");
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [selectedRelease, setSelectedRelease] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleRepoUrlChange = async (url: string) => {
    setRepoUrl(url);
    setBranches([]);
    setSelectedBranch("");
    setReleases([]);
    setSelectedRelease("");

    const repoInfo = parseGitHubUrl(url);
    if (!repoInfo) {
      return;
    }

    setIsFetchingBranches(true);
    try {
      const response = await fetch(
        `/api/github/branches?owner=${encodeURIComponent(repoInfo.owner)}&repo=${encodeURIComponent(repoInfo.repo)}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch branches");
      }

      const fetchedBranches = await response.json();
      setBranches(fetchedBranches);

      const defaultBranch =
        fetchedBranches.find((branch: { name: string; protected: boolean }) => branch.name === "main") ||
        fetchedBranches.find((branch: { name: string; protected: boolean }) => branch.name === "master") ||
        fetchedBranches[0];

      if (defaultBranch) {
        setSelectedBranch(defaultBranch.name);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    } finally {
      setIsFetchingBranches(false);
    }

    setIsFetchingReleases(true);
    try {
      const releasesResponse = await fetch(
        `/api/github/releases?owner=${encodeURIComponent(repoInfo.owner)}&repo=${encodeURIComponent(repoInfo.repo)}`
      );

      if (!releasesResponse.ok) {
        const error = await releasesResponse.json();
        throw new Error(error.error || "Failed to fetch releases");
      }

      const fetchedReleases = await releasesResponse.json();
      setReleases(fetchedReleases);
    } catch (error) {
      console.error("Error fetching releases:", error);
    } finally {
      setIsFetchingReleases(false);
    }
  };

  const resetForm = () => {
    setRepoUrl("");
    setBranches([]);
    setSelectedBranch("");
    setTimePreset("1week");
    setUseCustomRange(false);
    setCustomSince("");
    setCustomUntil("");
    setIncludeTagsInput("");
    setExcludeTagsInput("");
    setReleases([]);
    setSelectedRelease("");
    setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const repoInfo = parseGitHubUrl(repoUrl);
    if (!repoInfo) {
      setFormError("Please enter a valid GitHub repository URL.");
      return;
    }

    if (!selectedBranch) {
      setFormError("Please select a branch to analyze.");
      return;
    }

    const includeTags = parseTagsInput(includeTagsInput);
    const excludeTags = parseTagsInput(excludeTagsInput);
    const hasCustomRange = useCustomRange && customSince && customUntil;

    if (hasCustomRange && selectedRelease) {
      setFormError("Custom date ranges cannot be combined with a release selection.");
      return;
    }

    let customSinceIso: string | undefined;
    let customUntilIso: string | undefined;

    if (useCustomRange) {
      if (!customSince || !customUntil) {
        setFormError("Please provide both a start and end date for the custom range.");
        return;
      }

      const sinceDate = new Date(customSince);
      const untilDate = new Date(customUntil);

      if (Number.isNaN(sinceDate.getTime()) || Number.isNaN(untilDate.getTime())) {
        setFormError("Custom range dates must be valid.");
        return;
      }

      if (sinceDate > untilDate) {
        setFormError("The start date must be before the end date.");
        return;
      }

      customSinceIso = sinceDate.toISOString();
      customUntilIso = untilDate.toISOString();
    }

    if (includeTags.some((tag) => excludeTags.includes(tag))) {
      setFormError("A tag cannot be included and excluded at the same time.");
      return;
    }

    setIsLoading(true);
    try {
      setLoadingStep("📊 Fetching repository statistics...");

      const statsParams = new URLSearchParams({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
      });

      if (selectedBranch) {
        statsParams.set("branch", selectedBranch);
      }

      if (selectedRelease) {
        statsParams.set("releaseTag", selectedRelease);
      } else if (hasCustomRange && customSinceIso && customUntilIso) {
        statsParams.set("since", customSinceIso);
        statsParams.set("until", customUntilIso);
      } else {
        statsParams.set("timePeriod", timePreset);
      }

      if (includeTags.length > 0) {
        statsParams.set("includeTags", includeTags.join(","));
      }

      if (excludeTags.length > 0) {
        statsParams.set("excludeTags", excludeTags.join(","));
      }

      const statsResponse = await fetch(`/api/github/stats?${statsParams.toString()}`);

      if (!statsResponse.ok) {
        const error = await statsResponse.json();
        throw new Error(error.error || "Failed to fetch repository stats");
      }

      const stats: RepoStatsWithContext = await statsResponse.json();

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
          filters: {
            preset: !selectedRelease && !hasCustomRange ? timePreset : undefined,
            customRange:
              !selectedRelease && hasCustomRange && customSinceIso && customUntilIso
                ? { since: customSinceIso, until: customUntilIso }
                : undefined,
            includeTags: includeTags.length > 0 ? includeTags : undefined,
            excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
            releaseTag: selectedRelease || undefined,
          } satisfies PatchNoteFilters,
        }),
      });

      let aiSummaries: any[] = [];
      let aiOverallSummary: string | null = null;

      if (summariesResponse.ok) {
        const summaryData = await summariesResponse.json();
        aiSummaries = summaryData.summaries || [];
        aiOverallSummary = summaryData.overallSummary || null;
      }

      const timePeriodMode: TimePeriod = stats.timePeriod;

      const filters: PatchNoteFilters = {
        branch: selectedBranch,
        preset: !selectedRelease && !hasCustomRange ? timePreset : undefined,
        customRange:
          !selectedRelease && hasCustomRange && customSinceIso && customUntilIso
            ? { since: customSinceIso, until: customUntilIso }
            : undefined,
        includeTags: includeTags.length > 0 ? includeTags : undefined,
        excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
        releaseTag: selectedRelease || undefined,
        releaseBaseTag: stats.releaseBaseTag ?? null,
      };

      const contextLabel: string =
        stats.contextLabel ||
        (selectedRelease
          ? `Release ${selectedRelease}`
          : hasCustomRange && customSinceIso && customUntilIso
          ? `Custom range ${new Date(customSinceIso).toLocaleDateString()} – ${new Date(customUntilIso).toLocaleDateString()}`
          : PRESET_OPTIONS.find((option) => option.value === timePreset)?.label || "Repository Update");

      const content = aiOverallSummary
        ? `${aiOverallSummary}\n\n## Key Changes\n\n${aiSummaries
            .map(
              (summary) =>
                `### ${summary.message.split("\n")[0]}\n${summary.aiSummary}\n\n**Changes:** +${summary.additions} -${summary.deletions} lines`
            )
            .join("\n\n")}`
        : generateBoilerplateContent(`${repoInfo.owner}/${repoInfo.repo}`, contextLabel, stats);

      setLoadingStep(
        `🎬 Generating video data using ${aiSummaries.length > 0 ? "AI summaries" : "raw GitHub stats"}`
      );

      const videoData =
        aiSummaries.length > 0
          ? generateVideoDataFromAI(aiSummaries, aiOverallSummary || undefined)
          : await generateVideoData(`${repoInfo.owner}/${repoInfo.repo}`, timePeriodMode, stats);

      setLoadingStep("💾 Saving patch note...");
      const response = await fetch("/api/patch-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo_name: `${repoInfo.owner}/${repoInfo.repo}`,
          repo_url: repoUrl,
          time_period: timePeriodMode,
          title: `${contextLabel} - ${repoInfo.repo}`,
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
          generated_at: new Date().toISOString(),
          filters,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create patch note");
      }

      const created = await response.json();
      setOpen(false);
      resetForm();
      router.push(`/blog/${created.id}`);
      router.refresh();
    } catch (error) {
      console.error("Error creating patch note:", error);
      setFormError(error instanceof Error ? error.message : "Failed to create patch note");
    } finally {
      setIsLoading(false);
      setLoadingStep("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      setOpen(value);
      if (!value) {
        resetForm();
      }
    }}>
      <DialogTrigger asChild>
        <Button size="lg">
          <PlusIcon className="mr-2 h-5 w-5" />
          Create New Post
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Create Patch Note</DialogTitle>
            <DialogDescription>
              Generate AI-powered patch notes using custom intervals, release cuts, or tag filters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repo-url">Repository URL</Label>
              <Input
                id="repo-url"
                placeholder="https://github.com/owner/repository"
                value={repoUrl}
                onChange={(event) => handleRepoUrlChange(event.target.value)}
                disabled={isLoading}
                required
              />
              <p className="text-xs text-muted-foreground">
                {isFetchingBranches ? "Fetching branches..." : "Paste the GitHub repository link to get started."}
              </p>
            </div>

            {branches.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Select
                  value={selectedBranch}
                  onValueChange={setSelectedBranch}
                  disabled={isLoading || isFetchingBranches}
                >
                  <SelectTrigger id="branch">
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    {branches.map((branch) => (
                      <SelectItem key={branch.name} value={branch.name}>
                        {branch.name}
                        {branch.protected ? " 🔒" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Commits will be collected from the selected branch.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Quick presets</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={timePreset === option.value ? "default" : "outline"}
                      onClick={() => setTimePreset(option.value)}
                      className="text-sm"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="custom-range-toggle"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={useCustomRange}
                  onChange={(event) => setUseCustomRange(event.target.checked)}
                  disabled={isLoading}
                />
                <Label htmlFor="custom-range-toggle" className="font-normal">
                  Use custom date range
                </Label>
              </div>

              {useCustomRange && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-since">Start</Label>
                    <Input
                      id="custom-since"
                      type="datetime-local"
                      value={customSince}
                      onChange={(event) => setCustomSince(event.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-until">End</Label>
                    <Input
                      id="custom-until"
                      type="datetime-local"
                      value={customUntil}
                      onChange={(event) => setCustomUntil(event.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="release-select">Release (optional)</Label>
              <Select
                value={selectedRelease || EMPTY_RELEASE_VALUE}
                onValueChange={(value) =>
                  value === EMPTY_RELEASE_VALUE ? setSelectedRelease("") : setSelectedRelease(value)
                }
                disabled={isFetchingReleases || releases.length === 0 || isLoading}
              >
                <SelectTrigger id="release-select">
                  <SelectValue
                    placeholder={
                      isFetchingReleases
                        ? "Loading releases..."
                        : releases.length === 0
                        ? "No releases available"
                        : "Select a release"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  <SelectItem value={EMPTY_RELEASE_VALUE}>No release filter</SelectItem>
                  {releases.map((release) => (
                    <SelectItem key={release.id} value={release.tag_name}>
                      {release.name || release.tag_name}
                      {release.prerelease ? " (pre-release)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Release selections override preset or custom ranges by comparing against the prior release.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="include-tags">Include commits with labels</Label>
                <Input
                  id="include-tags"
                  placeholder="bug, feature"
                  value={includeTagsInput}
                  onChange={(event) => setIncludeTagsInput(event.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exclude-tags">Exclude commits with labels</Label>
                <Input
                  id="exclude-tags"
                  placeholder="chore"
                  value={excludeTagsInput}
                  onChange={(event) => setExcludeTagsInput(event.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="min-w-[200px]"
              disabled={
                isLoading ||
                isFetchingBranches ||
                !repoUrl ||
                !selectedBranch
              }
            >
              {isLoading ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  <span className="text-sm">{loadingStep || "Processing..."}</span>
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
