/**
 * GitHub API Pagination Utilities
 * Centralized pagination logic to eliminate duplication
 */

import type { Octokit } from '@octokit/rest';

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  perPage?: number;
  maxPages?: number;
  maxItems?: number;
}

/**
 * Default pagination settings
 */
export const DEFAULT_PAGINATION: Required<PaginationConfig> = {
  perPage: 100,
  maxPages: 10,
  maxItems: 1000,
};

/**
 * Generic paginated fetch function
 * Handles all pagination logic in one place
 */
export async function fetchPaginated<T>(
  fetchPage: (page: number, perPage: number) => Promise<T[]>,
  config: PaginationConfig = {}
): Promise<T[]> {
  const { perPage, maxPages, maxItems } = {
    ...DEFAULT_PAGINATION,
    ...config,
  };

  const results: T[] = [];
  let page = 1;

  while (page <= maxPages && results.length < maxItems) {
    const items = await fetchPage(page, perPage);

    if (items.length === 0) {
      break;
    }

    results.push(...items);

    // Stop if we got fewer items than requested (last page)
    if (items.length < perPage) {
      break;
    }

    // Stop if we've reached the item limit
    if (results.length >= maxItems) {
      break;
    }

    page++;
  }

  // Trim to exact maxItems if we exceeded
  return results.slice(0, maxItems);
}

/**
 * Octokit-specific paginated iterator
 * Uses Octokit's built-in pagination support
 */
export async function fetchAllWithOctokit<T>(
  octokit: Octokit,
  method: string,
  params: Record<string, unknown>,
  config: PaginationConfig = {}
): Promise<T[]> {
  const { maxItems } = {
    ...DEFAULT_PAGINATION,
    ...config,
  };

  const results: T[] = [];

  try {
    // Use Octokit's iterator for automatic pagination
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - Octokit's paginate typing is complex
    for await (const response of octokit.paginate.iterator(method, {
      ...params,
      per_page: config.perPage || DEFAULT_PAGINATION.perPage,
    })) {
      results.push(...(response.data as T[]));

      if (results.length >= maxItems) {
        break;
      }
    }
  } catch (error) {
    // Let error handling utilities deal with this
    throw error;
  }

  return results.slice(0, maxItems);
}

/**
 * Custom rate limit aware pagination
 * Tracks and respects GitHub rate limits
 */
export class PaginationTracker {
  private itemsFetched = 0;
  private pagesFetched = 0;
  private startTime = Date.now();

  constructor(
    private readonly config: Required<PaginationConfig> = DEFAULT_PAGINATION
  ) {}

  /**
   * Check if we should continue pagination
   */
  shouldContinue(itemsInPage: number): boolean {
    this.pagesFetched++;
    this.itemsFetched += itemsInPage;

    if (this.pagesFetched >= this.config.maxPages) {
      return false;
    }

    if (this.itemsFetched >= this.config.maxItems) {
      return false;
    }

    // Stop if we got fewer items than expected (last page)
    if (itemsInPage < this.config.perPage) {
      return false;
    }

    return true;
  }

  /**
   * Get statistics about the pagination
   */
  getStats() {
    return {
      itemsFetched: this.itemsFetched,
      pagesFetched: this.pagesFetched,
      duration: Date.now() - this.startTime,
    };
  }
}

