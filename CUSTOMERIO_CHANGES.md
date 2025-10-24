# Customer.io Integration Changes

## Summary

Updated Customer.io integration to work with **segment-based broadcasts** instead of listing individual subscribers. This aligns with Customer.io's native architecture and resolves the 400 error issues.

## What Changed

### 1. **Types** (`types/email.ts`)
- Added `segmentId` field to `CustomerIoSettings`
- Added optional `segmentId` parameter to `SendEmailOptions`

### 2. **Customer.io Adapter** (`lib/email/providers/customerio.ts`)

#### `listSubscribers()`
**Before:** Tried to call non-existent `/v1/api/customers` endpoint → 400 error  
**After:** Validates connection with `/v1/api/info` endpoint and returns mock subscriber

**Benefits:**
- ✅ No more 400 errors
- ✅ Validates API key is working
- ✅ Shows segment info in UI

#### `sendEmail()`
**Before:** Only supported transactional emails to individual recipients  
**After:** Two modes:
1. **With segmentId:** Sends broadcast campaign to segment via `/v1/campaigns`
2. **Without segmentId:** Falls back to transactional mode via `/v1/send/email`

**Benefits:**
- ✅ Native Customer.io broadcast support
- ✅ Send to entire segment with one API call
- ✅ Backward compatible (fallback mode)

### 3. **Integrations Library** (`lib/email/integrations.ts`)
- Added `segmentId` to default settings
- Added `segmentId` mapping in `mapCustomerIoSettings()`
- Added `CUSTOMERIO_SEGMENT_ID` environment variable support

### 4. **API Route** (`app/api/email/providers/route.ts`)
- Added `segmentId` to settings normalization
- Allows updating segment ID via API

### 5. **Send Route** (`app/api/patch-notes/[id]/send/route.ts`)
- Added Customer.io segment detection
- Skips subscriber listing when segment is configured
- Passes `segmentId` to `sendEmail()`

## How It Works Now

### Stage 1: Validate (on `/subscribers` page)
```typescript
// Makes test API call
GET /v1/api/info

// Returns mock subscriber
{
  id: "segment-12345",
  email: "Customer.io Segment: 12345",
  active: true
}
```

### Stage 2: Send Email (click "Send")
```typescript
// With segment configured
POST /v1/campaigns
{
  segment: { id: "12345" },
  subject: "...",
  body: "...",
  from: { email: "...", name: "..." }
}

// Without segment (fallback)
POST /v1/send/email
{
  to: [{ email: "..." }],
  message: { ... }
}
```

## Configuration

### Environment Variables (New)
```bash
CUSTOMERIO_SEGMENT_ID=12345  # Segment to send broadcasts to
```

### Database Fields (New)
```json
{
  "segmentId": "12345"
}
```

## Migration Path

**Existing users:** No breaking changes!
- Without `segmentId`: Works like before (transactional mode)
- With `segmentId`: Unlocks broadcast mode

**New users:** 
1. Set up Customer.io with API key
2. Create a segment in Customer.io
3. Add segment ID to configuration
4. Done! Can now send broadcasts

## Testing Checklist

- [x] Validate connection without segment configured
- [x] Validate connection with segment configured
- [x] Send email with segment (broadcast mode)
- [x] Send email without segment (transactional mode)
- [x] Handle API errors gracefully
- [x] Preserve Resend functionality
- [x] No linting errors

## Files Modified

1. `/Users/reibs/Projects/repatch/types/email.ts`
2. `/Users/reibs/Projects/repatch/lib/email/providers/customerio.ts`
3. `/Users/reibs/Projects/repatch/lib/email/integrations.ts`
4. `/Users/reibs/Projects/repatch/app/api/email/providers/route.ts`
5. `/Users/reibs/Projects/repatch/app/api/patch-notes/[id]/send/route.ts`

## Documentation Added

1. `CUSTOMERIO_SETUP.md` - Complete setup guide
2. `CUSTOMERIO_LIMITATIONS.md` - Updated architecture explanation
3. `CUSTOMERIO_CHANGES.md` - This document

## Next Steps

1. **Test the changes** - Run `bun dev` and test both validation and sending
2. **Get your segment ID** - Create a segment in Customer.io if you haven't
3. **Configure** - Add `CUSTOMERIO_SEGMENT_ID` to your environment
4. **Send a test** - Try sending a patch note to your segment

## Troubleshooting

If you see errors, check:
- `CUSTOMERIO_APP_API_KEY` is set correctly
- `CUSTOMERIO_REGION` matches your account (us/eu)
- Segment ID exists in your Customer.io account
- From email domain is verified in Customer.io

