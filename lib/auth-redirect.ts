/**
 * Sanitize redirect targets provided via query parameters to prevent
 * open redirect vulnerabilities. Only allow relative paths that start
 * with a forward slash; everything else falls back to the homepage.
 */
export function sanitizeRedirect(path?: string | null) {
  if (!path || !path.startsWith("/")) {
    return "/";
  }

  return path;
}


