/**
 * GitHub API Pagination Utilities
 * Unified pagination logic for all GitHub API endpoints
 */

import { GitHubClient } from './client';

export interface PaginationOptions {
  readonly perPage?: number;
  readonly maxPages?: number;
  readonly maxItems?: number;
}

export interface PaginationResult<T> {
  readonly items: T[];
  readonly totalPages: number;
  readonly hasMore: boolean;
}

const DEFAULT_PER_PAGE = 100;
const DEFAULT_MAX_PAGES = 100; // Safety limit to prevent infinite loops
const DEFAULT_MAX_ITEMS = 10000; // Overall safety limit

/**
 * Fetch paginated data from GitHub API
 */
export async function fetchPaginated<T>(
  client: GitHubClient,
  url: string,
  options: PaginationOptions = {}
): Promise<PaginationResult<T>> {
  const perPage = options.perPage ?? DEFAULT_PER_PAGE;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;

  const allItems: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPages && allItems.length < maxItems) {
    const pageUrl = `${url}${url.includes('?') ? '&' : '?'}per_page=${perPage}&page=${page}`;
    const response = await client.fetch(pageUrl);

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Expected array response from GitHub API');
    }

    if (data.length === 0) {
      hasMore = false;
      break;
    }

    allItems.push(...data);

    // If we got fewer items than requested, we've reached the end
    if (data.length < perPage) {
      hasMore = false;
    }

    page++;

    // Safety check: if we've hit the max items limit, stop
    if (allItems.length >= maxItems) {
      hasMore = false;
    }
  }

  return {
    items: allItems,
    totalPages: page - 1,
    hasMore,
  };
}

/**
 * Fetch a single page of data (no pagination)
 */
export async function fetchSinglePage<T>(
  client: GitHubClient,
  url: string
): Promise<T> {
  const response = await client.fetch(url);
  return response.json();
}
