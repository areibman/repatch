# Video Rendering State Machine - Implementation Summary

## Overview
Centralized state machine for video rendering to eliminate scattered status transitions, prevent race conditions, and improve reliability.

## Issues Addressed

### ✅ Before (Problems)
1. **Scattered transitions**: Status updates in `remotion-lambda-renderer.ts`, `patch-note-processor.service.ts`, and multiple API routes
2. **No centralized definition**: Status transitions were implicit and hard to reason about
3. **Database round-trips**: Every status check required database queries
4. **Race conditions**: Multiple processes could update status simultaneously without coordination
5. **Polling only**: Frontend had to poll `/video-status` endpoint repeatedly

### ✅ After (Solutions)
1. **Centralized state machine**: Single source of truth in `lib/services/video-render-state-machine.ts`
2. **Atomic transitions**: Optimistic locking prevents race conditions
3. **Efficient queries**: Single query per status check with caching opportunities
4. **SSE support**: Real-time updates via Server-Sent Events (optional replacement for polling)

## Files Created

### `lib/services/video-render-state-machine.ts`
- Defines all valid states: `idle`, `queued`, `rendering`, `completed`, `failed`
- Defines all valid events: `start`, `progress`, `complete`, `fail`, `cancel`
- State transition validation functions
- Mapping between database `processing_status` and state machine states

### `lib/services/video-render-state.service.ts`
- `getVideoRenderStatus()`: Single source of truth for status queries
- `transitionVideoRenderState()`: Atomic state transitions with optimistic locking
- Helper functions: `startVideoRenderTransition()`, `completeVideoRender()`, `failVideoRender()`, etc.
- Race condition prevention via database-level optimistic locking

### `app/api/patch-notes/[id]/video-status-stream/route.ts`
- SSE endpoint for real-time status updates
- Replaces polling with push-based updates
- Automatically closes when terminal state reached

## Files Modified

### `lib/remotion-lambda-renderer.ts`
- Refactored to use state machine for all status transitions
- `startVideoRender()`: Uses `startVideoRenderTransition()` and `markRenderStarted()`
- `checkVideoRenderStatus()`: Uses `getVideoRenderStatus()` from state service
- Legacy `getVideoRenderStatus()` maintained for backwards compatibility

### `app/api/patch-notes/[id]/regenerate-video/route.ts`
- Removed direct database updates
- Uses state machine via `startVideoRender()` and `failVideoRender()`

### `app/api/patch-notes/[id]/video-status/route.ts`
- Updated to use `checkVideoRenderStatus()` which uses state machine
- Maintains backwards compatibility

### `lib/services/index.ts`
- Exports all state machine functions and types

## State Machine Flow

```
idle → [start] → queued → [progress] → rendering → [complete] → completed
                                                           ↓
                                                      [fail] → failed
```

### Valid Transitions
- `idle` → `queued` (on `start` event)
- `queued` → `rendering` (on `progress` event)
- `queued` → `failed` (on `fail` or `cancel` event)
- `rendering` → `rendering` (on `progress` event - self-transition for updates)
- `rendering` → `completed` (on `complete` event)
- `rendering` → `failed` (on `fail` or `cancel` event)
- `failed` → `queued` (on `start` event - allows retry)

## Race Condition Prevention

The state machine uses optimistic locking:
1. Read current state from database
2. Validate transition is allowed
3. Update database only if state hasn't changed: `.eq('processing_status', current.processing_status)`
4. If no rows updated, return error (race condition detected)

This ensures only one process can successfully transition from a given state.

## Usage Examples

### Starting a Render
```typescript
const result = await startVideoRender(patchNoteId);
// Internally uses: startVideoRenderTransition() → markRenderStarted()
```

### Checking Status
```typescript
const status = await checkVideoRenderStatus(patchNoteId);
// Returns: { status: 'rendering', progress: 45, ... }
```

### Using SSE (Frontend)
```typescript
const eventSource = new EventSource(`/api/patch-notes/${id}/video-status-stream`);
eventSource.addEventListener('status', (e) => {
  const status = JSON.parse(e.data);
  // Update UI with status
});
```

## Benefits

1. **Reliability**: Atomic transitions prevent inconsistent states
2. **Debugging**: Single place to inspect state transitions
3. **Maintainability**: Clear state machine definition
4. **Performance**: Reduced database queries
5. **Real-time**: SSE enables push-based updates (optional)

## Migration Notes

- All existing API endpoints maintain backwards compatibility
- Legacy `getVideoRenderStatus()` function maps new states to old format
- Frontend can continue using polling or migrate to SSE

## Future Improvements

1. Add `processing_progress` column for finer-grained progress tracking
2. Implement database triggers for automatic state transitions
3. Add state transition logging/auditing
4. Cache status queries for frequently accessed patch notes
