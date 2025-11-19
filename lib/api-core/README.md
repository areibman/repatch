# Core API Layer

This directory contains the core business logic for the Repatch API, separated from Next.js route handlers.

## Structure

```
lib/api-core/
├── github/           # GitHub data operations
├── patch-notes/      # Patch note operations
├── templates/        # Template operations
├── subscribers/      # Subscriber operations
├── jobs/            # Job queue operations
└── types/           # Shared types
```

## Purpose

The core API layer provides:

1. **Framework-agnostic business logic**: Can be called from Next.js, MCP servers, or any other interface
2. **Consistent error handling**: All functions return `Result<T>` types
3. **Testability**: Pure functions that are easy to unit test
4. **Reusability**: Single source of truth for API operations

## Usage

```typescript
import { getGitHubMetadata } from '@/lib/api-core/github';

const result = await getGitHubMetadata({
  owner: 'facebook',
  repo: 'react',
  include: ['branches', 'releases']
});

if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

## Result Type

All operations return a `Result<T>` type:

```typescript
type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: string };
```

This enables:
- Explicit error handling
- Type-safe results
- Easy composition with other operations
