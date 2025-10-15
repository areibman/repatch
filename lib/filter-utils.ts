import { PatchNoteFilters, TimePreset } from "@/types/patch-note";

export const VALID_TIME_PRESETS: ReadonlyArray<TimePreset> = [
  "1day",
  "1week",
  "1month",
] as const;

const PRESET_LABELS: Record<TimePreset, string> = {
  "1day": "Last 24 Hours",
  "1week": "Last Week",
  "1month": "Last Month",
};

const CONFLICT_MESSAGE =
  "Choose either a date range or specific releases when generating patch notes.";

export class FilterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FilterValidationError";
  }
}

const sanitizeTokens = (values?: string[]) =>
  values && values.length > 0
    ? Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
    : undefined;

const assertNoOverlap = (label: string, include?: string[], exclude?: string[]) => {
  if (!include || !exclude) {
    return;
  }

  const conflict = include.find((token) => exclude.includes(token));
  if (conflict) {
    throw new FilterValidationError(
      `${label} "${conflict}" cannot be both included and excluded.`
    );
  }
};

export function normalizeFilters(
  filters?: PatchNoteFilters | null
): PatchNoteFilters {
  if (!filters) {
    return { mode: "preset", preset: "1week" };
  }

  const includeLabels = sanitizeTokens(filters.includeLabels);
  const excludeLabels = sanitizeTokens(filters.excludeLabels);
  const includeTags = sanitizeTokens(filters.includeTags);
  const excludeTags = sanitizeTokens(filters.excludeTags);

  assertNoOverlap("Label", includeLabels, excludeLabels);
  assertNoOverlap("Tag", includeTags, excludeTags);

  if (filters.mode === "preset") {
    if (!filters.preset) {
      throw new FilterValidationError("Select a preset interval to continue.");
    }
    if (!VALID_TIME_PRESETS.includes(filters.preset)) {
      throw new FilterValidationError("Unsupported preset interval selected.");
    }

    return {
      mode: "preset",
      preset: filters.preset,
      ...(includeLabels ? { includeLabels } : {}),
      ...(excludeLabels ? { excludeLabels } : {}),
      ...(includeTags ? { includeTags } : {}),
      ...(excludeTags ? { excludeTags } : {}),
    };
  }

  if (filters.mode === "custom") {
    if (filters.releases?.length) {
      throw new FilterValidationError(CONFLICT_MESSAGE);
    }

    const since = filters.customRange?.since;
    const until = filters.customRange?.until;

    if (!since || !until) {
      throw new FilterValidationError(
        "Custom ranges require both a start and end date."
      );
    }

    const start = new Date(since);
    const end = new Date(until);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new FilterValidationError("Enter valid dates for the custom range.");
    }

    if (start >= end) {
      throw new FilterValidationError(
        "The end date must be after the start date for custom ranges."
      );
    }

    return {
      mode: "custom",
      customRange: {
        since: start.toISOString(),
        until: end.toISOString(),
      },
      ...(includeLabels ? { includeLabels } : {}),
      ...(excludeLabels ? { excludeLabels } : {}),
      ...(includeTags ? { includeTags } : {}),
      ...(excludeTags ? { excludeTags } : {}),
    };
  }

  if (filters.mode === "release") {
    if (filters.customRange || filters.preset) {
      throw new FilterValidationError(CONFLICT_MESSAGE);
    }

    const releases = filters.releases ?? [];
    const unique = new Map<string, (typeof releases)[number]>();

    releases.forEach((release) => {
      if (!release?.tag) {
        return;
      }

      const tag = release.tag.trim();
      if (!tag || unique.has(tag)) {
        return;
      }

      unique.set(tag, {
        tag,
        name: release.name ?? null,
        previousTag: release.previousTag ?? null,
        publishedAt: release.publishedAt ?? null,
        targetCommitish: release.targetCommitish ?? null,
      });
    });

    if (unique.size === 0) {
      throw new FilterValidationError(
        "Select at least one release to generate patch notes from."
      );
    }

    return {
      mode: "release",
      releases: Array.from(unique.values()),
      ...(includeLabels ? { includeLabels } : {}),
      ...(excludeLabels ? { excludeLabels } : {}),
      ...(includeTags ? { includeTags } : {}),
      ...(excludeTags ? { excludeTags } : {}),
    };
  }

  throw new FilterValidationError("Unsupported filter mode provided.");
}

function formatDateRangeLabel(since?: string, until?: string) {
  if (!since || !until) return "Custom Range";
  const sinceDate = new Date(since);
  const untilDate = new Date(until);
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${formatter.format(sinceDate)} → ${formatter.format(untilDate)}`;
}

export function formatFilterSummary(
  filters?: PatchNoteFilters | null,
  fallbackTimePeriod?: TimePreset | "custom" | "release"
): string {
  if (!filters) {
    if (fallbackTimePeriod && fallbackTimePeriod in PRESET_LABELS) {
      return PRESET_LABELS[fallbackTimePeriod as TimePreset];
    }
    if (fallbackTimePeriod === "release") {
      return "Release Selection";
    }
    if (fallbackTimePeriod === "custom") {
      return "Custom Range";
    }
    return "Unknown Range";
  }

  switch (filters.mode) {
    case "preset":
      if (filters.preset && filters.preset in PRESET_LABELS) {
        return PRESET_LABELS[filters.preset];
      }
      return "Preset";
    case "custom":
      return formatDateRangeLabel(
        filters.customRange?.since,
        filters.customRange?.until
      );
    case "release":
      if (filters.releases && filters.releases.length > 0) {
        return filters.releases
          .map((release) => release.name || release.tag)
          .join(", ");
      }
      return "Release Selection";
    default:
      return "Custom Range";
  }
}

export function deriveTimePeriodValue(
  filters: PatchNoteFilters
): TimePreset | "custom" | "release" {
  if (filters.mode === "preset" && filters.preset) {
    return filters.preset;
  }
  return filters.mode === "release" ? "release" : "custom";
}

export function formatFilterDetailLabel(filters?: PatchNoteFilters | null) {
  if (!filters) return "";
  const label = formatFilterSummary(filters);
  switch (filters.mode) {
    case "preset":
      return label;
    case "custom":
      return `Custom Range (${label})`;
    case "release":
      return `Release Selection (${label})`;
    default:
      return label;
  }
}

export function getPresetLabel(preset: TimePreset) {
  return PRESET_LABELS[preset];
}
