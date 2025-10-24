# Customer.io Setup Guide

This guide explains how to configure Customer.io for sending patch note newsletters in Repatch using **API-triggered broadcasts**.

## Understanding Customer.io Architecture

According to the [Customer.io App API documentation](https://docs.customer.io/integrations/api/app/), Customer.io is designed around:
- **Broadcasts** - Campaign emails created in the UI and triggered via API
- **Segments** - Dynamic audiences based on user attributes and behavior  
- **Transactional messages** - Individual emails sent to specific recipients

For newsletters like patch notes, you should use **API-triggered broadcasts**.

## Setup Steps

### Step 1: Create an API-Triggered Broadcast in Customer.io

1. Log in to [Customer.io](https://customer.io) (or [EU region](https://app-eu.customer.io))
2. Go to **Campaigns** → **Broadcasts**
3. Click **Create Broadcast**
4. Design your email template:
   - Use liquid variables like `{{trigger.subject}}`, `{{trigger.body}}`, etc.
   - These will be populated when you trigger the broadcast from Repatch
5. Under **Audience**, select your target segment
6. Under **Send Settings**, choose **API-triggered**
7. Save the broadcast
8. Copy the **Broadcast ID** from the URL (e.g., `123` in `https://app.customer.io/campaigns/123`)

### Step 2: Get Your Customer.io Credentials

1. Go to **Settings** → **API Credentials**
2. Copy your **App API Key**
3. Note your region: `us` or `eu`

### Step 3: Configure Repatch

#### Option A: Environment Variables

Add to your `.env.local`:

```bash
# Required
CUSTOMERIO_APP_API_KEY=your_app_api_key_here
CUSTOMERIO_BROADCAST_ID=123  # Your API-triggered broadcast ID

# Optional
CUSTOMERIO_REGION=us  # or 'eu'
CUSTOMERIO_FROM_EMAIL=updates@yourdomain.com
CUSTOMERIO_FROM_NAME=Your Company
```

#### Option B: Database Configuration

1. Go to `/settings/email` in Repatch
2. Select **Customer.io**
3. Fill in:
   - **App API Key**: Your Customer.io App API key
   - **Region**: `us` or `eu`
   - **Broadcast ID**: Your API-triggered broadcast ID
   - **From Email**: Sender email address (must be verified in Customer.io)
   - **From Name**: Sender name
4. Click **Save & Activate**

## How It Works

### Stage 1: Validate Connection (`/subscribers` page)

When you visit the subscribers page, Repatch:
1. Shows the configured broadcast ID
2. Indicates that Customer.io is ready to send

**What you'll see:**
- ✅ "Customer.io Broadcast 123 (API-triggered broadcast configured)"
- ⚠️ "Customer.io (No broadcast ID - will use transactional email mode)"

### Stage 2: Trigger Broadcast (Click "Send Email")

When you click send, Repatch:
1. Calls `POST /v1/campaigns/{broadcast_id}/triggers`
2. Passes the email content as trigger data
3. Customer.io sends the broadcast to all segment members

**API Request:**
```json
POST https://api.customer.io/v1/campaigns/123/triggers
{
  "data": {
    "subject": "Patch Note Title",
    "body": "<html>...</html>",
    "plaintext_body": "..."
  }
}
```

**In your Customer.io template, reference the data:**
```html
<h1>{{trigger.subject}}</h1>
<div>{{trigger.body}}</div>
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CUSTOMERIO_APP_API_KEY` | ✅ Yes | - | Your App API key from Customer.io |
| `CUSTOMERIO_BROADCAST_ID` | ⚠️ Recommended | - | API-triggered broadcast ID |
| `CUSTOMERIO_REGION` | Optional | `us` | API region: `us` or `eu` |
| `CUSTOMERIO_FROM_EMAIL` | Optional | Fallback | Sender email (must be verified) |
| `CUSTOMERIO_FROM_NAME` | Optional | `Repatch` | Sender name |

## API Endpoints Used

- **Trigger Broadcast**: `POST /v1/campaigns/{id}/triggers` - Triggers API-triggered broadcast
- **Transactional Fallback**: `POST /v1/send/email` - Sends to individuals if no broadcast configured

## Creating Your Broadcast Template

Your Customer.io broadcast template should use liquid variables to access the trigger data:

### Available Trigger Variables

```liquid
{{trigger.subject}}         - Email subject
{{trigger.body}}            - HTML email body
{{trigger.plaintext_body}}  - Plain text version
```

### Example Template

```html
<!DOCTYPE html>
<html>
<head>
  <title>{{trigger.subject}}</title>
</head>
<body>
  {{{trigger.body}}}
  
  <footer>
    <p>Sent by Repatch</p>
  </footer>
</body>
</html>
```

**Note:** Use `{{{` (three braces) to render HTML without escaping.

## Troubleshooting

### "No broadcast ID configured"

- Add `CUSTOMERIO_BROADCAST_ID` to your environment variables
- Or configure it in the database via `/settings/email`

### Broadcast not triggering

- Verify the broadcast ID is correct
- Check that the broadcast is set to **API-triggered** in Customer.io
- Ensure your API key has proper permissions
- Verify you're using the correct region (`us` or `eu`)

### Emails not being delivered

- Check that the broadcast's segment has members
- Verify your `From Email` domain is verified in Customer.io
- Review Customer.io's campaign logs for delivery status
- Ensure the broadcast is not in draft mode

### Finding Your Broadcast ID

1. Log in to Customer.io
2. Go to **Campaigns** → **Broadcasts**
3. Click on your API-triggered broadcast
4. Look at the URL: `https://app.customer.io/campaigns/123`
5. The number (`123`) is your Broadcast ID

## Two Modes of Operation

### Mode 1: API-Triggered Broadcast (Recommended)

✅ **With `CUSTOMERIO_BROADCAST_ID` configured:**
- Triggers pre-designed broadcast in Customer.io
- Sends to entire segment with one API call
- Leverages Customer.io's UI for email design
- Supports A/B testing, scheduling, and analytics

### Mode 2: Transactional Email (Fallback)

⚠️ **Without `CUSTOMERIO_BROADCAST_ID`:**
- Sends individual transactional emails
- Requires listing subscribers (returns mock data)
- Not recommended for newsletters
- No campaign analytics

## Comparison: Resend vs Customer.io

| Feature | Resend | Customer.io |
|---------|--------|-------------|
| **Best for** | Simple newsletters | Advanced segmentation & campaigns |
| **Setup** | Just API key & audience ID | Requires broadcast creation in UI |
| **Subscriber list** | ✅ Can view in Repatch | ❌ Managed in Customer.io |
| **Email design** | Code-only | Rich UI + liquid templating |
| **Segmentation** | Basic | Advanced (behavior, attributes, events) |
| **Analytics** | Basic delivery stats | Full campaign analytics |
| **Use case** | Quick patch note setup | Enterprise email marketing |

## Recommendation

**Choose Customer.io if:**
- You already have Customer.io in your stack
- You need advanced segmentation and targeting
- You want to design emails in a UI
- You need campaign analytics and A/B testing

**Choose Resend if:**
- You want the simplest possible setup
- You prefer code-based email templates
- You want to manage subscribers in Repatch
- You don't need advanced segmentation

## Support

- [Customer.io Documentation](https://customer.io/docs/)
- [Customer.io App API Reference](https://docs.customer.io/integrations/api/app/)
- [Customer.io Broadcasts Guide](https://customer.io/docs/journeys/broadcasts/)
