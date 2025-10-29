/**
 * GitHub utility functions
 */

import type { TimePreset } from '@/types/patch-note';

/**
 * Parse repository information from GitHub URL
 */
export function parseGitHubUrl(
  url: string
): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
  if (match) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ''),
    };
  }
  return null;
}

/**
 * Calculate date range based on time period
 */
export function getDateRange(timePeriod: TimePreset): {
  since: string;
  until: string;
} {
  const now = new Date();
  const until = now.toISOString();

  const since = new Date(now);
  switch (timePeriod) {
    case '1day':
      since.setDate(since.getDate() - 1);
      break;
    case '1week':
      since.setDate(since.getDate() - 7);
      break;
    case '1month':
      since.setMonth(since.getMonth() - 1);
      break;
  }

  return { since: since.toISOString(), until };
}

/**
 * Sort branches: main/master first, then alphabetically
 */
export function sortBranches(
  branches: Array<{ name: string }>
): Array<{ name: string }> {
  return [...branches].sort((a, b) => {
    if (a.name === 'main') return -1;
    if (b.name === 'main') return 1;
    if (a.name === 'master') return -1;
    if (b.name === 'master') return 1;
    return a.name.localeCompare(b.name);
  });
}
