import http from "http";
import type { AddressInfo } from "net";
import { NextRequest } from "next/server";
import { test, expect, request } from "@playwright/test";
import {
  __resetApiKeyMemoryStore,
  __resetApiKeyRateLimits,
  __seedApiKeyMemoryStore,
  __setUseMemoryApiKeyStore,
  enforceExternalApiAuth,
  hashApiKey,
} from "@/lib/api-keys";
import {
  __resetMockExternalPatchNotes,
  __setMockExternalPatchNotes,
} from "@/lib/external-api";
import { GET as getPatchNotes } from "@/app/api/external/patch-notes/route";
import { GET as getSummaries } from "@/app/api/external/summaries/route";

let server: http.Server;
let baseURL: string;
let apiSecret: string;

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        headers.set(key, value.join(","));
      }
    }

    const authResult = await enforceExternalApiAuth(headers);
    if (!authResult.ok) {
      res.statusCode = authResult.status;
      if (authResult.headers) {
        authResult.headers.forEach((value, key) => res.setHeader(key, value));
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(authResult.body));
      return;
    }

    const requestInit: RequestInit = {
      method: req.method,
      headers: authResult.requestHeaders,
    };

    const requestUrl = url.toString();
    const nextRequest = new NextRequest(new Request(requestUrl, requestInit));
    let nextResponse: Response | null = null;

    if (url.pathname === "/api/external/patch-notes") {
      nextResponse = await getPatchNotes(nextRequest);
    } else if (url.pathname === "/api/external/summaries") {
      nextResponse = await getSummaries(nextRequest);
    } else {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    res.statusCode = nextResponse.status;
    nextResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const body = await nextResponse.text();
    res.end(body);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: (error as Error).message }));
  }
}

test.beforeAll(async () => {
  __setUseMemoryApiKeyStore(true);
  __resetApiKeyMemoryStore();
  __resetApiKeyRateLimits();
  __resetMockExternalPatchNotes();

  apiSecret = "rk_playwright_secret_123";
  const hash = await hashApiKey(apiSecret);
  const now = new Date().toISOString();

  __seedApiKeyMemoryStore({
    id: "playwright-key",
    name: "Playwright",
    description: "Playwright test key",
    created_by: "tests",
    token_hash: hash,
    last_four: apiSecret.slice(-4),
    rate_limit_per_minute: 2,
    metadata: { env: "test" },
    last_used_at: null,
    revoked_at: null,
    rotated_at: null,
    created_at: now,
    updated_at: now,
  });

  __setMockExternalPatchNotes([
    {
      id: "note-1",
      title: "Mock Release",
      repo: { name: "example/repo", url: "https://example.com" },
      summary: "Highlights from the latest release.",
      generatedAt: now,
      timePeriod: "1week",
      contributors: ["alice", "bob"],
      metrics: { added: 5, modified: 3, removed: 1 },
      highlights: ["New feature", "Bug fixes"],
    },
  ]);

  server = http.createServer((req, res) => {
    void handleRequest(req, res);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address() as AddressInfo;
  baseURL = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test.beforeEach(() => {
  __resetApiKeyRateLimits();
});

test("serves sanitized patch notes with a valid API key", async () => {
  const context = await request.newContext({ baseURL });
  const response = await context.get("/api/external/patch-notes", {
    headers: { "X-Api-Key": apiSecret },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body[0].highlights).toContain("New feature");
});

test("enforces rate limits for repeated requests", async () => {
  const context = await request.newContext({ baseURL });
  const first = await context.get("/api/external/patch-notes", {
    headers: { "X-Api-Key": apiSecret },
  });
  expect(first.status()).toBe(200);

  const second = await context.get("/api/external/patch-notes", {
    headers: { "X-Api-Key": apiSecret },
  });
  expect(second.status()).toBe(200);

  const third = await context.get("/api/external/patch-notes", {
    headers: { "X-Api-Key": apiSecret },
  });
  expect(third.status()).toBe(429);
  expect(third.headers().has("retry-after")).toBeTruthy();
});

test("provides lightweight summaries", async () => {
  const context = await request.newContext({ baseURL });
  const response = await context.get("/api/external/summaries", {
    headers: { "X-Api-Key": apiSecret },
  });

  expect(response.status()).toBe(200);
  const summaries = await response.json();
  expect(Array.isArray(summaries)).toBe(true);
  expect(summaries[0]).toMatchObject({ id: "note-1", title: "Mock Release" });
});
