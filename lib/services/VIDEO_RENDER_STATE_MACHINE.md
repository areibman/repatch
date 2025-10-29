# Video Render State Machine

## Overview

The video render state machine centralizes all video rendering status transitions, eliminating scattered status updates across multiple files and preventing race conditions.

## State Definitions

### Video Render States

- **`pending`**: Initial state, no render started
- **`generating_video`**: Render job initiated on Lambda, waiting for progress
- **`rendering`**: Active render in progress (Lambda reports progress)
- **`completed`**: Video successfully rendered and stored
- **`failed`**: Render failed at any stage

## Valid State Transitions

The state machine enforces these valid transitions:

```
pending → generating_video → rendering → completed
                           ↓         ↓
                         failed    failed
                           ↓
                    generating_video (retry)
```

- `pending` → `generating_video` (when render starts)
- `generating_video` → `rendering` (when Lambda reports first progress)
- `generating_video` → `completed` (if Lambda completes immediately)
- `generating_video` → `failed` (when render fails to start)
- `rendering` → `completed` (when render succeeds)
- `rendering` → `failed` (when render fails)
- `failed` → `generating_video` (retry allowed)
- Any state → `failed` (error can occur from any state)

## Usage

### Starting a Video Render

```typescript
import { startVideoRenderTransition } from '@/lib/services/video-render-state-machine';

// Called automatically by startVideoRender() in remotion-lambda-renderer.ts
await startVideoRenderTransition(patchNoteId, renderId, bucketName);
```

### Updating Progress

```typescript
import { updateVideoRenderProgress } from '@/lib/services/video-render-state-machine';

// Automatically transitions generating_video → rendering on first progress update
await updateVideoRenderProgress(patchNoteId, progressPercent);
```

### Completing a Render

```typescript
import { completeVideoRenderTransition } from '@/lib/services/video-render-state-machine';

await completeVideoRenderTransition(patchNoteId, videoUrl);
```

### Handling Failures

```typescript
import { failVideoRenderTransition } from '@/lib/services/video-render-state-machine';

await failVideoRenderTransition(patchNoteId, errorMessage);
```

### Resetting for Retry

```typescript
import { resetVideoRender } from '@/lib/services/video-render-state-machine';

// Clears video data and prepares for new render
await resetVideoRender(patchNoteId);
```

### Getting Current Status

```typescript
import { getCurrentVideoRenderStatus } from '@/lib/services/video-render-state-machine';

const current = await getCurrentVideoRenderStatus(patchNoteId);
// Returns: { status, videoUrl, renderId, bucketName, error }
```

## Benefits

1. **Centralized Logic**: All status transitions go through one place
2. **Type Safety**: Invalid transitions are caught at runtime with clear error messages
3. **Race Condition Prevention**: Status is always read from database before transitioning
4. **Consistency**: Status updates are atomic and consistent across the codebase
5. **Debuggability**: All transitions are logged with clear before/after states

## Migration Notes

All status updates should now go through the state machine functions:

- ❌ **Don't**: Directly update `processing_status` in database
- ✅ **Do**: Use state machine transition functions

The state machine automatically:
- Validates transitions
- Updates related fields (render_id, bucket_name, video_url, etc.)
- Clears tracking fields when transitioning to terminal states
- Handles edge cases (e.g., immediate completion before progress)

## Integration Points

The state machine is integrated into:

1. **`lib/remotion-lambda-renderer.ts`**: Core render functions
2. **`app/api/patch-notes/[id]/regenerate-video/route.ts`**: Regeneration endpoint
3. **`app/api/patch-notes/[id]/video-status/route.ts`**: Status polling endpoint (uses getVideoRenderStatus which internally uses state machine)
