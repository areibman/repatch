/**
 * GitHub API Integration
 * 
 * This file maintains backward compatibility by re-exporting from the modular structure.
 * 
 * The codebase has been refactored into focused modules:
 * - client.ts: Core API client with rate limiting and error handling
 * - pagination.ts: Shared pagination logic
 * - cache.ts: Caching layer for expensive API calls
 * - repositories.ts: Branch, tag, release, and label operations
 * - commits.ts: Commit-related operations
 * - filters.ts: Commit filtering logic
 * - stats.ts: Repository statistics aggregation
 * - content.ts: Content generation utilities
 * - utils.ts: Helper functions
 * 
 * @deprecated The deprecated functions generateVideoDataFromAI and generateVideoData
 * have been removed. Use generateVideoTopChangesFromContent from ai-summarizer.ts instead.
 */

// Re-export everything from the modular structure
export * from './github/index';
