/**
 * GitHub API Pagination Utilities
 * Shared pagination logic for GitHub API endpoints
 */

import { githubRequest, type GitHubRequestConfig } from './client';

/**
 * Default pagination limits for safety
 */
export const PAGINATION_LIMITS = {
  MAX_PAGES: 100,
  MAX_ITEMS: 10000,
  DEFAULT_PER_PAGE: 100,
} as const;

/**
 * Pagination options
 */
export interface PaginationOptions {
  /**
   * Maximum number of pages to fetch (default: 100)
   */
  maxPages?: number;
  
  /**
   * Maximum total items to fetch (default: 10000)
   */
  maxItems?: number;
  
  /**
   * Items per page (default: 100)
   */
  perPage?: number;
  
  /**
   * Additional request configuration
   */
  requestConfig?: GitHubRequestConfig;
}

/**
 * Paginate through GitHub API endpoint
 * Automatically handles pagination and safety limits
 */
export async function paginateGitHubApi<T>(
  url: string,
  options: PaginationOptions = {}
): Promise<T[]> {
  const {
    maxPages = PAGINATION_LIMITS.MAX_PAGES,
    maxItems = PAGINATION_LIMITS.MAX_ITEMS,
    perPage = PAGINATION_LIMITS.DEFAULT_PER_PAGE,
    requestConfig,
  } = options;

  const allItems: T[] = [];
  let page = 1;
  const baseUrl = new URL(url);
  
  // Ensure per_page is set
  baseUrl.searchParams.set('per_page', perPage.toString());

  while (page <= maxPages && allItems.length < maxItems) {
    baseUrl.searchParams.set('page', page.toString());
    
    const items = await githubRequest<T[]>(baseUrl.toString(), requestConfig);
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      break; // No more items
    }
    
    allItems.push(...items);
    
    // If we got fewer items than requested, we've reached the end
    if (items.length < perPage) {
      break;
    }
    
    // Safety check: stop if we've reached max items
    if (allItems.length >= maxItems) {
      break;
    }
    
    page++;
  }

  return allItems;
}
