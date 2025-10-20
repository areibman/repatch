import { PatchNoteFilterMetadata, PatchNoteTimePreset } from "@/types/patch-note";

export interface FilterValidationResult {
  ok: boolean;
  reason?: string;
  normalized: PatchNoteFilterMetadata;
}

const QUICK_PRESET_LABELS: Record<Exclude<PatchNoteTimePreset, "custom">, string> = {
  "1day": "Past 24 Hours",
  "1week": "Past 7 Days",
  "1month": "Past 30 Days",
};

export function validateFilterMetadata(
  metadata: Partial<PatchNoteFilterMetadata> | null | undefined
): FilterValidationResult {
  const normalized: PatchNoteFilterMetadata = {
    mode: metadata?.mode || (metadata?.releaseRange ? "release" : metadata?.customRange ? "custom" : "preset"),
    preset: metadata?.preset,
    customRange: metadata?.customRange,
    releaseRange: metadata?.releaseRange,
    includeLabels: metadata?.includeLabels?.filter(Boolean) || [],
    excludeLabels: metadata?.excludeLabels?.filter(Boolean) || [],
    branch: metadata?.branch ?? null,
  };

  if (normalized.mode === "preset") {
    if (!normalized.preset) {
      return { ok: false, reason: "A preset interval must be selected for quick presets.", normalized };
    }
  }

  if (normalized.mode === "custom") {
    if (!normalized.customRange?.since || !normalized.customRange?.until) {
      return { ok: false, reason: "Custom ranges require both a start and end date.", normalized };
    }

    const sinceDate = new Date(normalized.customRange.since);
    const untilDate = new Date(normalized.customRange.until);

    if (Number.isNaN(sinceDate.getTime()) || Number.isNaN(untilDate.getTime())) {
      return { ok: false, reason: "Custom range dates must be valid ISO timestamps.", normalized };
    }

    if (sinceDate > untilDate) {
      return { ok: false, reason: "The custom range start must be before the end date.", normalized };
    }
  }

  if (normalized.mode === "release") {
    if (!normalized.releaseRange?.headTag) {
      return { ok: false, reason: "Select a release to compare against.", normalized };
    }

    if (
      normalized.releaseRange.baseTag &&
      normalized.releaseRange.baseTag === normalized.releaseRange.headTag
    ) {
      return {
        ok: false,
        reason: "Base and target releases must be different to calculate changes.",
        normalized,
      };
    }
  }

  if (normalized.includeLabels?.length && normalized.excludeLabels?.length) {
    const overlap = normalized.includeLabels.filter((label) =>
      normalized.excludeLabels?.includes(label)
    );
    if (overlap.length > 0) {
      return {
        ok: false,
        reason: `Labels cannot be both included and excluded (${overlap.join(", ")}).`,
        normalized,
      };
    }
  }

  return { ok: true, normalized };
}

export function getFilterSummaryLabel(
  metadata: PatchNoteFilterMetadata,
  fallbackPreset?: PatchNoteTimePreset
): string {
  switch (metadata.mode) {
    case "preset": {
      const preset = metadata.preset || (fallbackPreset && fallbackPreset !== "custom" ? fallbackPreset : undefined);
      if (!preset) return "Recent Activity";
      return QUICK_PRESET_LABELS[preset];
    }
    case "custom": {
      if (metadata.customRange?.since && metadata.customRange?.until) {
        const since = new Date(metadata.customRange.since);
        const until = new Date(metadata.customRange.until);
        const formatter = new Intl.DateTimeFormat("en", {
          month: "short",
          day: "numeric",
        });
        return `Custom Range (${formatter.format(since)} – ${formatter.format(until)})`;
      }
      return "Custom Range";
    }
    case "release": {
      if (metadata.releaseRange?.baseTag) {
        return `Releases ${metadata.releaseRange.baseTag} → ${metadata.releaseRange.headTag}`;
      }
      return `Release ${metadata.releaseRange?.headTag ?? "Selection"}`;
    }
    default:
      return fallbackPreset && fallbackPreset !== "custom"
        ? QUICK_PRESET_LABELS[fallbackPreset]
        : "Recent Activity";
  }
}

export function getFilterShortLabel(
  metadata: PatchNoteFilterMetadata,
  fallbackPreset?: PatchNoteTimePreset
): string {
  switch (metadata.mode) {
    case "preset":
      return metadata.preset || (fallbackPreset && fallbackPreset !== "custom" ? fallbackPreset : "recent");
    case "custom":
      return "custom";
    case "release":
      return metadata.releaseRange?.headTag || "release";
    default:
      return fallbackPreset || "recent";
  }
}
