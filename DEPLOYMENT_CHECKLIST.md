# Deployment Checklist for Video Rendering Fix

## Quick Summary
Fixed production video rendering errors by:
1. ✅ Adding proper error handling to prevent JSON parsing of HTML error pages
2. ✅ Configuring Vercel function timeouts and memory limits
3. ✅ Adding route segment config for extended execution time

## Changes Made

### 1. `/app/api/patch-notes/route.ts`
Added response validation before JSON parsing AND authentication forwarding:
- Checks response status (`res.ok`)
- Validates Content-Type header
- Returns helpful error messages with actual server response
- Forwards cookies to internal API calls for authentication

### 2. `/app/api/videos/render/route.ts`
Added route segment configuration:
```typescript
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';
```

### 3. `/package.json`
Moved Remotion runtime dependencies from `devDependencies` to `dependencies`:
- `@remotion/bundler`
- `@remotion/tailwind-v4`
- `style-loader`, `css-loader`, `postcss-loader`

**Critical**: These packages are needed at runtime in serverless functions, not just during build.

### 4. `/vercel.json` (NEW)
Created Vercel configuration for video rendering:
```json
{
  "functions": {
    "app/api/videos/render/route.ts": {
      "maxDuration": 300,
      "memory": 1024
    }
  }
}
```

## Required Actions Before Deploying

### 1. Verify Vercel Plan
- ⚠️ **Requires Vercel Pro plan or higher** for 300s timeout
- Free tier is limited to 10s timeout (not sufficient for video rendering)
- Check your plan at: https://vercel.com/dashboard/settings/billing

### 2. Environment Variables
Ensure ALL of these are set in Vercel:

**Critical (Required for video rendering):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_VIDEO_BUCKET=videos
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app

# Internal API secret for bypassing Vercel Protection
# Generate a strong random secret: openssl rand -base64 32
INTERNAL_API_SECRET=your-random-secret-here
```

**AI & GitHub (Required for content generation):**
```bash
GEMINI_API_KEY=AIza...
GOOGLE_API_KEY=AIza...
GITHUB_TOKEN=ghp_...
```

**Optional (Email & Social):**
```bash
RESEND_API_KEY=re_...
RESEND_AUDIENCE_ID=...
TYPEFULLY_API_KEY=...
```

### 3. Supabase Setup
Verify Supabase Storage is configured:
1. Storage bucket named `videos` exists
2. Bucket has appropriate access policies
3. Service role key has storage permissions

## Deployment Steps

```bash
# 1. Review changes
git status
git diff

# 2. Commit all changes
git add vercel.json app/api/patch-notes/route.ts app/api/videos/render/route.ts PRODUCTION_VIDEO_FIX.md DEPLOYMENT_CHECKLIST.md
git commit -m "Fix video rendering in production

- Add proper error handling for video render API calls
- Configure Vercel function timeout (300s) and memory (3GB)
- Add route segment config for extended execution
- Create comprehensive troubleshooting guide

Fixes video rendering failures caused by timeout limits and
JSON parsing errors when API returns HTML error pages."

# 3. Push to deploy
git push origin master

# 4. Monitor deployment
# Go to Vercel Dashboard and watch the deployment logs
```

## Testing After Deployment

1. **Create a new patch note** through the UI
2. **Monitor the logs** in Vercel Dashboard → Logs
3. **Expected behavior:**
   - Patch note created immediately (201 response)
   - Video rendering happens in background
   - Video appears within 1-5 minutes
4. **If video rendering fails:**
   - Check logs for detailed error message
   - Verify environment variables
   - Confirm Vercel plan supports 300s timeout

## Fallback: Remotion Lambda (Production Alternative)

If Vercel rendering is still problematic, consider **Remotion Lambda**:

**Pros:**
- No timeout limits
- Better performance and reliability
- Dedicated video rendering infrastructure
- More cost-effective at scale

**Setup:**
1. Follow guide: https://www.remotion.dev/docs/lambda/setup
2. Deploy Lambda function to AWS
3. Update code to use `renderMediaOnLambda()` instead of `renderMedia()`
4. Store AWS credentials in Vercel environment variables

This is the **recommended production approach** for high-volume or mission-critical video rendering.

## Troubleshooting Common Issues

### "Still getting SyntaxError: Unexpected token '<'"
- The fix now logs the actual error message
- Check Vercel logs for details
- Common causes:
  - Missing environment variables
  - Route still timing out (check Vercel plan)
  - Memory limit exceeded

### "401 Authentication Required" error
- This occurs when Vercel's authentication wrapper blocks internal API calls
- **FIXED**: Cookies are now forwarded from the original request
- If still occurring:
  - Check if you have Vercel Protection/Authentication enabled in project settings
  - Go to Vercel Dashboard → Your Project → Settings → Deployment Protection
  - Consider disabling password protection or adding an exception for `/api/videos/*`
  - Or bypass the issue entirely using Vercel's Serverless Function authentication bypass header

### "Video rendering timeout"
- Verify `vercel.json` is deployed
- Confirm Vercel Pro plan is active
- Check function logs for actual runtime
- Consider reducing video complexity or duration

### "Out of memory"
- Increase `memory` in `vercel.json` (requires higher tier)
- Or switch to Remotion Lambda

### "Cannot find module '@remotion/bundler'" or "Cannot find module 'style-loader'"
- **FIXED**: Remotion packages are now in `dependencies` (not `devDependencies`)
- Vercel doesn't install devDependencies in production
- If you still see this error, run `bun install` locally and redeploy

## Success Indicators

✅ Patch notes are created successfully  
✅ Video rendering completes within 1-5 minutes  
✅ Videos appear in the UI and emails  
✅ No HTML parsing errors in logs  
✅ Supabase storage shows video files  

## Need Help?

1. Check `PRODUCTION_VIDEO_FIX.md` for detailed troubleshooting
2. Review Vercel function logs
3. Test locally with `bun dev` to isolate issues
4. Consider Remotion Lambda for production reliability

