const DEFAULT_APP_BASE_URL = "http://localhost:3000";

interface AppBaseUrlOptions {
  /**
   * Optional fallback to use when no environment or runtime origin is available.
   */
  fallback?: string;
}

/**
 * Resolve the canonical application base URL across server and browser contexts.
 *
 * Priority order:
 *   1. Browser runtime origin (when `window` is available)
 *   2. `NEXT_PUBLIC_APP_URL`
 *   3. Server-only overrides (`APP_URL`, then `VERCEL_URL`)
 *   4. Provided fallback (e.g., request origin)
 *   5. Default local development URL
 */
export function getAppBaseUrl(options: AppBaseUrlOptions = {}): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  if (process.env.VERCEL_URL) {
    const normalizedVercelUrl = process.env.VERCEL_URL.startsWith("http")
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`;
    return normalizedVercelUrl;
  }

  if (options.fallback) {
    return options.fallback;
  }

  return DEFAULT_APP_BASE_URL;
}


