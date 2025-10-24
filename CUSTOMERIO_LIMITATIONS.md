# Customer.io Integration - Segment-Based Architecture

## How It Works Now

Customer.io integration in Repatch has been updated to work with **segments** (Customer.io's native model) instead of trying to list individual subscribers.

### Two-Stage Process

#### Stage 1: Validate Connection (`/subscribers` page)
- Makes a test API call to Customer.io to verify credentials
- Shows a mock subscriber entry representing your segment
- Confirms your integration is properly configured

#### Stage 2: Send Emails (Click "Send Email")
- Sends a **broadcast campaign** to your Customer.io segment
- All segment members receive the patch note email
- Customer.io handles delivery and tracking

## Why This Approach?

Customer.io's API is designed around:
- **Segments** - dynamic groups based on user attributes and behavior
- **Broadcasts** - campaign emails sent to segments
- **Event-driven messaging** - triggered by user actions

This is fundamentally different from Resend's model of managing individual subscriber lists via API.

## What You Need

1. **Customer.io App API Key** - For authentication
2. **Segment ID** - The segment to send broadcasts to
3. **Verified From Email** - Domain must be verified in Customer.io

## Configuration

See `CUSTOMERIO_SETUP.md` for detailed setup instructions.

Quick start:
```bash
CUSTOMERIO_APP_API_KEY=your_key
CUSTOMERIO_SEGMENT_ID=12345
CUSTOMERIO_REGION=us
```

## Features

✅ **Connection validation** - Test your API credentials  
✅ **Broadcast to segment** - Send to all segment members  
✅ **Region support** - US and EU endpoints  
✅ **Fallback mode** - Can send to individual emails if no segment configured  

## Limitations

❌ **Cannot view individual subscribers** in Repatch UI  
❌ **Cannot add/remove subscribers** from Repatch UI  

**Why?** Customer.io doesn't expose these APIs. Subscriber management happens in Customer.io dashboard through segment rules.

## When to Use Customer.io vs Resend

### Use Customer.io if:
- You already have Customer.io in your stack
- You need advanced segmentation
- You want behavioral triggers
- You need multi-channel messaging (email, SMS, push)

### Use Resend if:
- You want simple subscriber management in Repatch
- You prefer managing individual subscriber lists
- You need a straightforward newsletter setup

## Migration Note

If you previously configured Customer.io and encountered errors, the integration has been updated to:
1. Stop trying to list all customers (which caused 400 errors)
2. Use segment-based broadcasts instead
3. Validate connections properly

No action needed - just add your `CUSTOMERIO_SEGMENT_ID` to complete the setup!

