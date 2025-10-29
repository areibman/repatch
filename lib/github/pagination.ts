/**
 * Pagination utilities for GitHub API
 * Centralized pagination logic to eliminate duplication
 */

import type { GitHubClient } from './client';

export interface PaginationOptions {
  readonly maxPages?: number;
  readonly perPage?: number;
  readonly maxItems?: number;
}

export interface PaginationResult<T> {
  readonly items: T[];
  readonly totalPages: number;
  readonly hasMore: boolean;
}

const DEFAULT_PAGINATION_OPTIONS: Required<PaginationOptions> = {
  maxPages: 10,
  perPage: 100,
  maxItems: 1000,
};

/**
 * Paginate through GitHub API endpoint
 * Handles pagination automatically based on Link headers or manual page-based iteration
 */
export async function paginate<T>(
  client: GitHubClient,
  endpoint: string,
  options: PaginationOptions = {}
): Promise<T[]> {
  const opts = { ...DEFAULT_PAGINATION_OPTIONS, ...options };
  const allItems: T[] = [];
  let page = 1;

  while (page <= opts.maxPages && allItems.length < opts.maxItems) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${endpoint}${separator}per_page=${opts.perPage}&page=${page}`;

    const data = await client.request<T[]>(url, {}, false); // Don't cache paginated requests

    if (!Array.isArray(data) || data.length === 0) {
      break; // No more items
    }

    allItems.push(...data);

    // If we got fewer items than requested, we've reached the end
    if (data.length < opts.perPage) {
      break;
    }

    // Safety check: if we've hit max items, stop
    if (allItems.length >= opts.maxItems) {
      break;
    }

    page++;
  }

  return allItems;
}

/**
 * Paginate with custom item transformation
 */
export async function paginateMap<T, R>(
  client: GitHubClient,
  endpoint: string,
  transform: (item: T) => R | null,
  options: PaginationOptions = {}
): Promise<R[]> {
  const items = await paginate<T>(client, endpoint, options);
  return items.map(transform).filter((item): item is R => item !== null);
}

/**
 * Get pagination metadata
 */
export function getPaginationMetadata(
  items: unknown[],
  perPage: number
): PaginationResult<unknown> {
  return {
    items,
    totalPages: Math.ceil(items.length / perPage),
    hasMore: items.length % perPage === 0 && items.length > 0,
  };
}
