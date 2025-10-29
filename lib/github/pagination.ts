/**
 * Unified pagination utilities for GitHub API
 */

import { getGitHubClient } from "./client";

export interface PaginationOptions {
  perPage?: number;
  maxPages?: number;
  maxItems?: number;
}

export const DEFAULT_PAGINATION_OPTIONS: Required<PaginationOptions> = {
  perPage: 100,
  maxPages: 50,
  maxItems: 5000,
};

/**
 * Fetch all pages of a paginated GitHub API endpoint
 */
export async function fetchAllPages<T>(
  endpoint: string,
  options: PaginationOptions = {}
): Promise<T[]> {
  const { perPage, maxPages, maxItems } = {
    ...DEFAULT_PAGINATION_OPTIONS,
    ...options,
  };

  const client = getGitHubClient();
  const allItems: T[] = [];
  let page = 1;

  while (page <= maxPages && allItems.length < maxItems) {
    const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}per_page=${perPage}&page=${page}`;
    const cacheKey = `pagination:${url}`;

    try {
      const items = await client.request<T[]>(url, {
        cacheKey,
        // Cache individual pages for 5 minutes
        cacheTTL: 300,
      });

      if (!Array.isArray(items) || items.length === 0) {
        break;
      }

      allItems.push(...items);

      // If we got fewer items than requested, we've reached the end
      if (items.length < perPage) {
        break;
      }

      page++;

      // Safety check: stop if we've reached max items
      if (allItems.length >= maxItems) {
        break;
      }
    } catch (error) {
      // If it's the first page and it fails, throw the error
      if (page === 1) {
        throw error;
      }
      // Otherwise, log and break (partial results)
      console.warn(`[Pagination] Error fetching page ${page}:`, error);
      break;
    }
  }

  return allItems;
}

/**
 * Fetch a single page (for endpoints that don't need pagination)
 */
export async function fetchSinglePage<T>(
  endpoint: string,
  options: { cacheKey?: string; cacheTTL?: number } = {}
): Promise<T> {
  const client = getGitHubClient();
  const { cacheKey, cacheTTL } = options;

  return client.request<T>(endpoint, {
    cacheKey: cacheKey || `single:${endpoint}`,
    cacheTTL: cacheTTL || 300,
  });
}
