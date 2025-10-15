import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";

const patchNoteId = "11111111-1111-1111-1111-111111111111";

const patchNoteRecord = {
  id: patchNoteId,
  repo_name: "acme/awesome-project",
  repo_url: "https://github.com/acme/awesome-project",
  time_period: "1week" as const,
  title: "Weekly update",
  content: "- Added search\n- Fixed bugs\n- Improved docs",
  changes: { added: 120, modified: 45, removed: 10 },
  contributors: ["@alice", "@bob"],
  video_data: {
    langCode: "en",
    topChanges: [
      { title: "Search", description: "Added search module" },
    ],
    allChanges: ["Search added", "Bug fixes", "Docs improvements"],
  },
  video_url: null,
  ai_summaries: null,
  ai_overall_summary: null,
  generated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const configRecord = {
  id: "config-1",
  slug: "default",
  api_key: "tf_api_key",
  profile_id: "profile_123",
  display_name: "Repatch",
  team_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

test("queues Typefully thread with mock video upload", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  process.env.NODE_ENV = "test";
  process.env.TYPEFULLY_RENDER_STRATEGY = "mock";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

  const insertedJobs: Array<Record<string, unknown>> = [];

  const supabaseMock = {
    from(table: string) {
      if (table === "patch_notes") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          single: async () => ({ data: patchNoteRecord, error: null }),
        };
      }

      if (table === "typefully_configs") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: configRecord, error: null }),
        };
      }

      if (table === "typefully_jobs") {
        return {
          insert(rows: Array<Record<string, unknown>>) {
            return {
              select() {
                return {
                  single: async () => {
                    const job = {
                      ...rows[0],
                      id: "job-123",
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    };
                    insertedJobs.push(job);
                    return { data: job, error: null };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  (globalThis as any).__SUPABASE_TEST_CLIENT = supabaseMock;

  const originalFetch = global.fetch;
  const fetchCalls: Array<{ url: string; method: string }> = [];

  global.fetch = (async (input: RequestInfo, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
        ? input.url
        : String(input);
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");

    fetchCalls.push({ url, method });

    if (url.includes("/uploads")) {
      return new Response(
        JSON.stringify({ assetId: "asset-1", uploadUrl: "https://upload.example.com/mock" }),
        { status: 200 }
      );
    }

    if (url === "https://upload.example.com/mock") {
      return new Response(null, { status: 200 });
    }

    if (url.includes("/drafts")) {
      return new Response(JSON.stringify({ id: "draft-1" }), { status: 200 });
    }

    if (url.includes("/queue")) {
      return new Response(JSON.stringify({ id: "thread-1" }), { status: 200 });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  }) as typeof fetch;

  const module = await import("@/app/api/patch-notes/[id]/typefully/route");

  const request = new NextRequest(
    `http://localhost/api/patch-notes/${patchNoteId}/typefully`,
    {
      method: "POST",
      body: JSON.stringify({ includeVideo: true }),
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const response = await module.POST(request, {
    params: Promise.resolve({ id: patchNoteId }),
  });

  expect(response.status).toBe(200);
  const payload = await response.json();

  expect(payload.status).toBe("queued");
  expect(payload.threadId).toBe("thread-1");
  expect(insertedJobs).toHaveLength(1);
  expect(fetchCalls.find((call) => call.url.includes("/drafts"))).toBeTruthy();
  expect(fetchCalls.find((call) => call.url.includes("/queue"))).toBeTruthy();
  expect(fetchCalls.find((call) => call.url === "https://upload.example.com/mock"))
    .toBeTruthy();

  global.fetch = originalFetch;
  delete (globalThis as any).__SUPABASE_TEST_CLIENT;
  delete process.env.TYPEFULLY_RENDER_STRATEGY;
  if (originalNodeEnv) {
    process.env.NODE_ENV = originalNodeEnv;
  } else {
    delete process.env.NODE_ENV;
  }
  if (originalAppUrl) {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  } else {
    delete process.env.NEXT_PUBLIC_APP_URL;
  }
});
