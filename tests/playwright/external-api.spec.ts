import { createServer } from "http";
import type { AddressInfo } from "net";
import { createHash } from "crypto";
import { test, expect } from "@playwright/test";
import {
  resetRateLimitStore,
  validateApiKey,
} from "@/lib/api-keys/auth";
import {
  getSanitizedPatchNotes,
  type SanitizedPatchNote,
} from "@/lib/external/patch-notes";

const SUPABASE_URL = "https://supabase.test";
const SERVICE_KEY = "service-key";
const VALID_TOKEN = "rp_feedface_1234567890abcdef1234567890abcdef";
const RATE_LIMIT_TOKEN = "rp_deadbeef_abcdefabcdefabcdefabcdefabcd";

const apiKeyRecords = [
  {
    id: "key-valid",
    name: "Playwright",
    prefix: "feedface",
    token_hash: createHash("sha256").update(VALID_TOKEN).digest("hex"),
    rate_limit_per_minute: 5,
    revoked_at: null as string | null,
  },
  {
    id: "key-limited",
    name: "Limited",
    prefix: "deadbeef",
    token_hash: createHash("sha256")
      .update(RATE_LIMIT_TOKEN)
      .digest("hex"),
    rate_limit_per_minute: 1,
    revoked_at: null as string | null,
  },
];

const patchNotes = [
  {
    id: "note-1",
    title: "Release 1.0",
    repo_name: "repatch",
    repo_url: "https://github.com/example/repatch",
    time_period: "1week" as const,
    generated_at: new Date("2024-01-15T12:00:00Z").toISOString(),
    content: "<h1>Headline</h1><script>alert('xss')</script>Changelog",
    changes: { added: 10, modified: 2, removed: 1 },
    contributors: ["alice", "bob"],
    ai_overall_summary: "  Trim me  ",
    ai_summaries: null,
  },
];

let baseURL: string;
let originalFetch: typeof fetch;
let server: ReturnType<typeof createServer>;

function buildSupabaseResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test.beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  resetRateLimitStore();

  originalFetch = global.fetch;

  global.fetch = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) => {
    const target = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (target.startsWith(`${SUPABASE_URL}/rest/v1/api_keys`)) {
      if ((init?.method || (input instanceof Request && input.method)) === "PATCH") {
        return new Response(null, { status: 204 });
      }
      const search = new URL(target).searchParams;
      const prefixParam = search.get("prefix");
      const prefix = prefixParam?.replace("eq.", "");
      const record = apiKeyRecords.find((item) => item.prefix === prefix);
      return buildSupabaseResponse(record ? [record] : []);
    }

    if (target.startsWith(`${SUPABASE_URL}/rest/v1/patch_notes`)) {
      const search = new URL(target).searchParams;
      const idParam = search.get("id");
      if (idParam) {
        const id = idParam.replace("eq.", "");
        const match = patchNotes.find((item) => item.id === id);
        return buildSupabaseResponse(match ? [match] : []);
      }
      return buildSupabaseResponse(patchNotes);
    }

    return originalFetch(input as Parameters<typeof fetch>[0], init);
  }) as typeof fetch;

  server = createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400).end();
      return;
    }

    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/external/patch-notes") {
      const token = req.headers["x-api-key"];
      const headerValue = Array.isArray(token) ? token[0] : token ?? null;
      const validation = await validateApiKey(headerValue);
      if (!validation.ok) {
        res.writeHead(validation.status, {
          "Content-Type": "application/json",
          ...(validation.retryAfter ? { "Retry-After": String(validation.retryAfter) } : {}),
        });
        res.end(JSON.stringify({ error: validation.message }));
        return;
      }

      const notes = await getSanitizedPatchNotes();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: notes }));
      return;
    }

    res.writeHead(404).end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;
  baseURL = `http://127.0.0.1:${address.port}`;

  test.info().annotations.push({ type: "server", description: baseURL });
});

test.afterAll(async () => {
  global.fetch = originalFetch;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

test.beforeEach(() => {
  resetRateLimitStore();
});

test("serves sanitized patch notes", async ({ request }) => {
  const response = await request.get(`${baseURL}/api/external/patch-notes`, {
    headers: { "X-Api-Key": VALID_TOKEN },
  });

  expect(response.status()).toBe(200);
  const body = (await response.json()) as { data: SanitizedPatchNote[] };
  expect(body.data).toHaveLength(1);
  const note = body.data[0];
  expect(note.content).not.toContain("<");
  expect(note.ai_overall_summary).toBe("Trim me");
});

test("rejects missing API key", async ({ request }) => {
  const response = await request.get(`${baseURL}/api/external/patch-notes`);
  expect(response.status()).toBe(401);
});

test("applies rate limiting", async ({ request }) => {
  const first = await request.get(`${baseURL}/api/external/patch-notes`, {
    headers: { "X-Api-Key": RATE_LIMIT_TOKEN },
  });
  expect(first.status()).toBe(200);

  const second = await request.get(`${baseURL}/api/external/patch-notes`, {
    headers: { "X-Api-Key": RATE_LIMIT_TOKEN },
  });
  expect(second.status()).toBe(429);
  expect(second.headers().get("retry-after")).not.toBeNull();
});
