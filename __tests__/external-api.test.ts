import {
  __resetApiKeyMemoryStore,
  __resetApiKeyRateLimits,
  __seedApiKeyMemoryStore,
  __setUseMemoryApiKeyStore,
  enforceExternalApiAuth,
  generateApiKeySecret,
  hashApiKey,
} from "@/lib/api-keys";
import {
  __resetMockExternalPatchNotes,
  __setMockExternalPatchNotes,
  fetchSanitizedPatchNotes,
} from "@/lib/external-api";

describe("external API authentication", () => {
  beforeEach(() => {
    __setUseMemoryApiKeyStore(true);
    __resetApiKeyMemoryStore();
    __resetApiKeyRateLimits();
  });

  it("rejects requests without an API key", async () => {
    const result = await enforceExternalApiAuth(new Headers());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.body.error).toContain("Missing");
    }
  });

  it("rejects invalid API keys", async () => {
    const headers = new Headers({ "X-Api-Key": "rk_invalid" });
    const result = await enforceExternalApiAuth(headers);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });

  it("allows valid API keys and forwards metadata", async () => {
    const secret = generateApiKeySecret();
    const hash = await hashApiKey(secret);
    const now = new Date().toISOString();

    __seedApiKeyMemoryStore({
      id: "test-key",
      name: "Test Key",
      description: null,
      created_by: null,
      token_hash: hash,
      last_four: secret.slice(-4),
      rate_limit_per_minute: 3,
      metadata: { environment: "test" },
      last_used_at: null,
      revoked_at: null,
      rotated_at: null,
      created_at: now,
      updated_at: now,
    });

    const headers = new Headers({ "X-Api-Key": secret });
    const result = await enforceExternalApiAuth(headers);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.requestHeaders.get("x-repatch-api-key-id")).toBe("test-key");
      expect(result.key.name).toBe("Test Key");
    }
  });

  it("enforces per-key rate limits", async () => {
    const secret = "rk_rate_limit";
    const hash = await hashApiKey(secret);
    const now = new Date().toISOString();

    __seedApiKeyMemoryStore({
      id: "limited",
      name: "Limited Key",
      description: null,
      created_by: null,
      token_hash: hash,
      last_four: secret.slice(-4),
      rate_limit_per_minute: 2,
      metadata: null,
      last_used_at: null,
      revoked_at: null,
      rotated_at: null,
      created_at: now,
      updated_at: now,
    });

    const headers = new Headers({ "X-Api-Key": secret });
    const first = await enforceExternalApiAuth(headers);
    const second = await enforceExternalApiAuth(headers);
    const third = await enforceExternalApiAuth(headers);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.status).toBe(429);
      expect(third.headers?.get("Retry-After")).toBeDefined();
    }
  });
});

describe("external API data helpers", () => {
  beforeEach(() => {
    __resetMockExternalPatchNotes();
  });

  it("returns sanitized patch note data", async () => {
    __setMockExternalPatchNotes([
      {
        id: "note-1",
        title: "Release 1.0",
        repo: { name: "repo", url: "https://example.com" },
        summary: "Overall summary",
        generatedAt: new Date().toISOString(),
        timePeriod: "1week",
        contributors: ["alice"],
        metrics: { added: 1, modified: 2, removed: 0 },
        highlights: ["Highlight"],
      },
    ]);

    const notes = await fetchSanitizedPatchNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0].highlights).toContain("Highlight");
  });
});
