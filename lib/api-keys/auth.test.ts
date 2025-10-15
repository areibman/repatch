import { createHash } from "crypto";
import {
  resetRateLimitStore,
  validateApiKey,
} from "@/lib/api-keys/auth";

describe("validateApiKey", () => {
  const SUPABASE_URL = "https://supabase.test";
  const SERVICE_KEY = "service-key";

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
    resetRateLimitStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns success for a valid API key", async () => {
    const token = "rp_aaaaaaaa_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const hash = createHash("sha256").update(token).digest("hex");

    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "1",
          name: "Test",
          prefix: "aaaaaaaa",
          token_hash: hash,
          rate_limit_per_minute: 10,
          revoked_at: null,
        },
      ],
    } as unknown as Response);

    const result = await validateApiKey(token);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.id).toBe("1");
    }
  });

  it("rejects revoked keys", async () => {
    const token = "rp_bbbbbbbb_cccccccccccccccccccccccccccccccc";
    const hash = createHash("sha256").update(token).digest("hex");

    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "2",
          name: "Revoked",
          prefix: "bbbbbbbb",
          token_hash: hash,
          rate_limit_per_minute: 5,
          revoked_at: new Date().toISOString(),
        },
      ],
    } as unknown as Response);

    const result = await validateApiKey(token);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.message).toContain("revoked");
    }
  });

  it("enforces rate limits", async () => {
    const token = "rp_cccccccc_dddddddddddddddddddddddddddddddd";
    const hash = createHash("sha256").update(token).digest("hex");

    jest.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => [
          {
            id: "3",
            name: "Limited",
            prefix: "cccccccc",
            token_hash: hash,
            rate_limit_per_minute: 1,
            revoked_at: null,
          },
        ],
      } as unknown as Response)
    );

    const first = await validateApiKey(token);
    expect(first.ok).toBe(true);

    const second = await validateApiKey(token);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.status).toBe(429);
      expect(second.retryAfter).toBeGreaterThan(0);
    }
  });

  it("handles unknown keys", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as unknown as Response);

    const result = await validateApiKey("rp_dddddddd_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });
});
