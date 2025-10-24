# Production Video Rendering Fix

## Problem
Video generation fails in production with the error:
```
❌ Background video rendering failed: SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON
```

This occurs because the `/api/videos/render` endpoint is returning an HTML error page instead of JSON, which causes the JSON parsing to fail.

## Root Causes

### 1. Timeout Issues
Video rendering with Remotion takes 30-60 seconds or more. Vercel's default timeout is 10 seconds (free tier) or 60 seconds (pro tier). The video rendering route needs extended timeout configuration.

### 2. Memory Constraints
Remotion bundling and video rendering require significant memory (2-3GB). Default serverless functions have 1GB memory limit.

### 3. Missing Error Handling
The fetch call to the video render endpoint didn't properly check response status or content-type before attempting to parse JSON.

## Fixes Applied

### 1. Improved Error Handling & Authentication in `/app/api/patch-notes/route.ts`
Added proper response validation before parsing JSON AND cookie forwarding:

```typescript
// Get cookies from the current request to pass to internal API call
const cookieHeader = request.headers.get('cookie');

fetch(videoRenderUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Pass cookies for authentication in production
    ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
  },
  body: JSON.stringify({...}),
}).then(async res => {
  console.log('✅ Video rendering request sent, status:', res.status);
  
  // Check if response is actually JSON before parsing
  const contentType = res.headers.get('content-type');
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Video render API returned ${res.status}: ${text.substring(0, 200)}`);
  }
  
  if (!contentType || !contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Video render API returned non-JSON response (${contentType}): ${text.substring(0, 200)}`);
  }
  
  return res.json();
})
```

This provides better error messages AND passes authentication cookies to internal API calls.

### 2. Route Configuration (`app/api/videos/render/route.ts`)
```typescript
export const maxDuration = 300; // 5 minutes (requires Vercel Pro)
export const dynamic = 'force-dynamic';
```

### 3. Moved Remotion Dependencies (`package.json`)
Moved webpack loaders and Remotion bundler packages from `devDependencies` to `dependencies`:

**Why?** Vercel doesn't install `devDependencies` in production. Since video rendering happens at runtime in serverless functions, these packages must be available:
- `@remotion/bundler` - Required for bundling Remotion project
- `@remotion/tailwind-v4` - Tailwind support for Remotion
- `style-loader` - Webpack loader for CSS
- `css-loader` - Webpack loader for CSS modules  
- `postcss-loader` - PostCSS processing

Without this change, you'll get: `Error: Cannot find module 'style-loader'`

### 4. Created `vercel.json` Configuration
Added proper function configuration for video rendering:

```json
{
  "functions": {
    "app/api/videos/render/route.ts": {
      "maxDuration": 300,
      "memory": 3008
    }
  }
}
```

**Note**: 
- `maxDuration: 300` (5 minutes) requires a **Vercel Pro** plan or higher
- `memory: 3008` MB requires proper plan tier
- Free tier is limited to 10s timeout and 1024MB memory

## Deployment Checklist

### Internal API Secret Bypass

To bypass Vercel Protection/Authentication for internal server-to-server calls, we use a shared secret:

**In production (Vercel):**
1. Generate a strong random secret:
   ```bash
   openssl rand -base64 32
   ```
2. Add to Vercel environment variables:
   ```
   INTERNAL_API_SECRET=<your-generated-secret>
   ```

This allows the patch notes API to call the video render API even when Vercel Protection is enabled.

### Required Environment Variables in Vercel
Ensure all these are set in Vercel Project Settings → Environment Variables:

```bash
# Supabase (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_VIDEO_BUCKET=videos

# Google AI / Gemini (REQUIRED for AI summaries)
GEMINI_API_KEY=AIza...
GOOGLE_API_KEY=AIza...

# GitHub (REQUIRED to avoid rate limits)
GITHUB_TOKEN=ghp_...

# App URL (REQUIRED for video rendering callbacks)
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app

# Email sending (optional, but needed for sending newsletters)
RESEND_API_KEY=re_...
RESEND_AUDIENCE_ID=...

# Social media (optional)
TYPEFULLY_API_KEY=...
```

### Deployment Steps

1. **Add the `vercel.json` file** (already done)

2. **Commit and push changes**:
   ```bash
   git add vercel.json app/api/patch-notes/route.ts PRODUCTION_VIDEO_FIX.md
   git commit -m "Fix video rendering in production with proper error handling and Vercel config"
   git push
   ```

3. **Configure Vercel Project**:
   - Go to your Vercel project dashboard
   - Navigate to Settings → General
   - Ensure you're on a **Pro plan** (required for 300s timeout)
   - Verify all environment variables are set

4. **Deploy**:
   - Vercel will automatically deploy on push
   - Or manually trigger: `vercel --prod`

5. **Test the fix**:
   - Create a new patch note
   - Monitor the logs in Vercel dashboard: Settings → Logs
   - Look for detailed error messages if video rendering still fails

## Alternative: Use Remotion Lambda (Recommended for Production)

For production workloads, consider using **Remotion Lambda** instead of rendering on Vercel:

### Benefits:
- No timeout limits
- Better performance
- Dedicated rendering infrastructure
- Cost-effective for high volume

### Setup:
1. Follow Remotion Lambda docs: https://www.remotion.dev/docs/lambda/setup
2. Deploy rendering function to AWS Lambda
3. Update `/app/api/videos/render/route.ts` to use `renderMediaOnLambda()` instead of `renderMedia()`

Example:
```typescript
import { renderMediaOnLambda } from '@remotion/lambda/client';

// Instead of renderMedia()
await renderMediaOnLambda({
  region: 'us-east-1',
  functionName: 'remotion-render-xxx',
  composition,
  serveUrl: bundleLocation,
  codec: 'h264',
  // ... other options
});
```

## Troubleshooting

### Still getting HTML errors?
Check the actual error by looking at Vercel logs:
1. Go to Vercel Dashboard → Your Project → Logs
2. Filter by `/api/videos/render`
3. Look for the detailed error message now being logged

Common issues:
- Missing environment variables (especially `SUPABASE_SERVICE_ROLE_KEY`)
- Timeout still too short (upgrade Vercel plan)
- Out of memory (increase memory in vercel.json)
- Missing dependencies in production build

### Video render succeeds but video doesn't play?
Check:
1. Supabase Storage bucket exists and is accessible
2. `SUPABASE_VIDEO_BUCKET` environment variable matches bucket name
3. Signed URL generation is working (check `/api/videos/signed-url` endpoint)

### Still need help?
1. Check Vercel function logs for detailed error messages
2. Test video rendering locally: `bun dev` and create a patch note
3. Verify all dependencies are in `dependencies` (not `devDependencies`)
4. Consider switching to Remotion Lambda for production reliability

