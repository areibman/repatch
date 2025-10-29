# GitHub API Integration

A refactored, modular GitHub API client built on Octokit with comprehensive error handling, caching, and rate limiting.

## 🎯 Goals Achieved

This refactoring addresses all the issues identified in the original monolithic `lib/github.ts`:

### ✅ Problems Solved

1. **Modular Architecture** - Split 1032-line monolith into focused modules
2. **Eliminated Duplicate Pagination** - Centralized pagination logic in `pagination.ts`
3. **Consistent Error Handling** - Unified error handling in `error.ts`
4. **Response Caching** - Added LRU cache layer for expensive API calls
5. **Rate Limit Management** - Built-in rate limiting with Octokit plugins
6. **Removed Deprecated Functions** - Cleaned up unused code
7. **Standardized Safety Limits** - Consistent limits via `DEFAULT_PAGINATION`

## 📁 Structure

```
lib/github/
├── index.ts                  # Main exports and documentation
├── types.ts                  # TypeScript type definitions
├── client.ts                 # Octokit client with rate limiting
├── error.ts                  # Error handling utilities
├── cache.ts                  # Response caching layer
├── pagination.ts             # Pagination utilities
├── api/
│   ├── repository.ts         # Branches, tags, releases, labels
│   ├── commits.ts            # Commit fetching and stats
│   ├── pull-requests.ts      # PR details and comments
│   ├── filters.ts            # Commit filtering logic
│   └── stats.ts              # Statistics aggregation
└── utils/
    └── boilerplate.ts        # Content generation helpers
```

## 🚀 Key Features

### 1. **Octokit Integration**
- Official GitHub SDK with TypeScript support
- Automatic retry with exponential backoff
- Rate limit throttling and detection
- Request/response type safety

### 2. **Smart Caching**
```typescript
import { fetchGitHubBranches, globalCache } from '@/lib/github';

// First call - fetches from API
const branches = await fetchGitHubBranches('owner', 'repo');

// Subsequent calls (within 5 min) - returns from cache
const cached = await fetchGitHubBranches('owner', 'repo');

// Manual cache control
globalCache.clear();
globalCache.clearExpired();
```

### 3. **Rate Limit Management**
```typescript
import { getRateLimit, waitForRateLimit } from '@/lib/github';

// Check current rate limit
const limit = await getRateLimit();
console.log(`${limit.remaining}/${limit.limit} calls remaining`);

// Wait if low on calls
await waitForRateLimit(10); // Waits if < 10 calls remaining
```

### 4. **Consistent Error Handling**
```typescript
import { GitHubApiError, RateLimitError } from '@/lib/github';

try {
  const commits = await fetchGitHubCommits('owner', 'repo', since, until);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error('Rate limited until:', error.resetAt);
  } else if (error instanceof GitHubApiError) {
    console.error('API error:', error.message, error.statusCode);
  }
}
```

### 5. **Centralized Pagination**
```typescript
import { fetchPaginated, DEFAULT_PAGINATION } from '@/lib/github';

// Custom pagination config
const items = await fetchPaginated(
  async (page, perPage) => {
    // Your API call here
    return data;
  },
  {
    perPage: 100,      // Items per page
    maxPages: 10,      // Max pages to fetch
    maxItems: 1000,    // Max total items
  }
);
```

## 📖 Usage Examples

### Fetching Repository Metadata

```typescript
import {
  fetchGitHubBranches,
  fetchGitHubTags,
  fetchGitHubReleases,
  fetchGitHubLabels,
} from '@/lib/github';

// Fetch all branches (cached)
const branches = await fetchGitHubBranches('owner', 'repo');

// Fetch without cache
const freshBranches = await fetchGitHubBranches('owner', 'repo', false);

// Other metadata
const tags = await fetchGitHubTags('owner', 'repo');
const releases = await fetchGitHubReleases('owner', 'repo');
const labels = await fetchGitHubLabels('owner', 'repo');
```

### Filtering Commits

```typescript
import { getCommitsForFilters } from '@/lib/github';

// Preset time filter
const weekCommits = await getCommitsForFilters('owner', 'repo', {
  mode: 'preset',
  preset: '1week',
});

// Custom date range
const customCommits = await getCommitsForFilters('owner', 'repo', {
  mode: 'custom',
  customRange: {
    since: '2024-01-01',
    until: '2024-01-31',
  },
});

// Release-based filtering
const releaseCommits = await getCommitsForFilters('owner', 'repo', {
  mode: 'release',
  releases: [
    { tag: 'v1.0.0', previousTag: 'v0.9.0' },
  ],
});

// With label filters
const filteredCommits = await getCommitsForFilters('owner', 'repo', {
  mode: 'preset',
  preset: '1week',
  includeLabels: ['feature', 'enhancement'],
  excludeLabels: ['wip', 'draft'],
});
```

### Aggregating Statistics

```typescript
import { getRepoStats } from '@/lib/github';

const stats = await getRepoStats('owner', 'repo', filters, 'main');

console.log(`Commits: ${stats.commits}`);
console.log(`Additions: ${stats.additions}`);
console.log(`Deletions: ${stats.deletions}`);
console.log(`Contributors: ${stats.contributors.join(', ')}`);
```

### Pull Request Details

```typescript
import { fetchPullRequestDetails } from '@/lib/github';

const pr = await fetchPullRequestDetails('owner', 'repo', 123);

if (pr) {
  console.log(`Title: ${pr.title}`);
  console.log(`Comments: ${pr.comments.length}`);
  if (pr.issueNumber) {
    console.log(`Linked issue: #${pr.issueNumber} - ${pr.issueTitle}`);
  }
}
```

## 🔧 Configuration

### Environment Variables

- `GITHUB_TOKEN` - GitHub personal access token (optional but recommended)
  - Without token: 60 requests/hour
  - With token: 5,000 requests/hour

### Cache Configuration

```typescript
import { GitHubCache } from '@/lib/github';

// Custom cache instance
const cache = new GitHubCache({
  ttl: 10 * 60 * 1000,  // 10 minutes
  maxSize: 200,          // 200 entries
});
```

### Pagination Configuration

```typescript
import { DEFAULT_PAGINATION } from '@/lib/github';

// Defaults:
// - perPage: 100
// - maxPages: 10
// - maxItems: 1000
```

## 🔄 Migration Guide

### From Old API

The refactored API maintains backward compatibility. All existing imports work unchanged:

```typescript
// ✅ No changes needed
import { fetchGitHubBranches, getRepoStats } from '@/lib/github';
```

### Deprecated Functions

The following functions were removed:

- ❌ `generateVideoData` - Use `generateVideoTopChangesFromContent` from `ai-summarizer.ts`
- ❌ `generateVideoDataFromAI` - Use `generateVideoTopChangesFromContent` from `ai-summarizer.ts`

## 🧪 Testing

```bash
# Type checking
bunx tsc --noEmit

# Linting
bun run lint lib/github

# Build
bun run build
```

## 📊 Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Lines of code | 1,032 | ~800 (split across modules) | Better organization |
| Duplicate pagination logic | 5+ instances | 1 centralized utility | DRY principle |
| Error handling | Inconsistent | Unified error types | Predictable errors |
| Caching | None | LRU cache with TTL | Reduced API calls |
| Rate limit handling | Ad-hoc | Built-in with Octokit | Automatic retry |
| Type safety | Partial | Full TypeScript | Better DX |

## 🔐 Security

- Environment variables for sensitive tokens
- No hardcoded credentials
- Rate limit protection prevents abuse
- Error messages sanitized to avoid leaking tokens

## 📝 Contributing

When adding new GitHub API functionality:

1. Add types to `types.ts`
2. Create focused function in appropriate `api/*.ts` file
3. Export from `index.ts`
4. Add documentation and examples
5. Consider caching for expensive operations
6. Use centralized error handling
7. Test with and without GitHub token

## 📚 Resources

- [Octokit Documentation](https://octokit.github.io/rest.js/)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Rate Limiting Best Practices](https://docs.github.com/en/rest/guides/best-practices-for-integrators#dealing-with-rate-limits)

