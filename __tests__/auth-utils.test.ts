import {
  hashPersonalAccessToken,
  requireRole,
  roleAtLeast,
  ForbiddenError,
} from "@/lib/auth";
import { sanitizeRedirect } from "@/lib/auth-redirect";

describe("hashPersonalAccessToken", () => {
  it("produces a stable hash for the same input", () => {
    const secret = "rpt_example-secret";
    expect(hashPersonalAccessToken(secret)).toBe(
      hashPersonalAccessToken(secret)
    );
  });

  it("produces different hashes for different tokens", () => {
    const hashA = hashPersonalAccessToken("rpt_token_a");
    const hashB = hashPersonalAccessToken("rpt_token_b");
    expect(hashA).not.toEqual(hashB);
  });
});

describe("sanitizeRedirect", () => {
  it("falls back to root when the path is invalid", () => {
    expect(sanitizeRedirect(null)).toBe("/");
    expect(sanitizeRedirect("https://example.com")).toBe("/");
    expect(sanitizeRedirect("")).toBe("/");
  });

  it("keeps relative paths that start with a slash", () => {
    expect(sanitizeRedirect("/subscribers")).toBe("/subscribers");
    expect(sanitizeRedirect("/settings/templates")).toBe(
      "/settings/templates"
    );
  });
});

describe("role helpers", () => {
  const viewer = { role: "viewer" as const };
  const admin = { role: "admin" as const };

  it("evaluates minimum role", () => {
    expect(roleAtLeast(admin, "editor")).toBe(true);
    expect(roleAtLeast(viewer, "editor")).toBe(false);
  });

  it("throws when role requirements are not met", () => {
    expect(() => requireRole(viewer, ["admin"])).toThrow(ForbiddenError);
    expect(() => requireRole(admin, ["admin"])).not.toThrow();
  });
});


