import http from "http";
import { test, expect } from "@playwright/test";

test.describe("Typefully queueing", () => {
  const mediaPayloads: Array<Record<string, unknown>> = [];
  const threadPayloads: Array<Record<string, unknown>> = [];
  let server: http.Server;

  test.beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        if (req.method === "POST" && req.url === "/media") {
          const json = body ? JSON.parse(body) : {};
          mediaPayloads.push(json);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              id: "media_mock",
              url: "https://typefully.test/media/mock",
            })
          );
          return;
        }
        if (req.method === "POST" && req.url === "/threads") {
          const json = body ? JSON.parse(body) : {};
          threadPayloads.push(json);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              id: "thread_mock",
              status: "queued",
              url: "https://typefully.test/thread/mock",
            })
          );
          return;
        }
        res.writeHead(404);
        res.end();
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(4455, resolve);
    });
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  test("queues a thread with mock Typefully API", async ({ page, request }) => {
    const patchNoteResponse = await request.post("/api/patch-notes", {
      data: {
        repo_name: "example/repo",
        repo_url: "https://github.com/example/repo",
        time_period: "1week",
        title: "Test Patch Note",
        content: "- Added feature A\n- Fixed bug B",
        changes: { added: 10, modified: 2, removed: 1 },
        contributors: ["dev1"],
        video_data: {
          langCode: "en",
          topChanges: [
            { title: "Feature A", description: "It is awesome" },
          ],
          allChanges: ["Feature A released", "Bug B fixed"],
        },
      },
    });

    expect(patchNoteResponse.ok()).toBeTruthy();
    const patchNote = await patchNoteResponse.json();
    expect(patchNote.id).toBeTruthy();

    await page.goto(`/blog/${patchNote.id}`);
    await page.getByRole("button", { name: "Queue Twitter thread" }).click();

    await expect(
      page.getByText("Thread queued in Typefully.")
    ).toBeVisible({ timeout: 20_000 });

    await expect(page.getByText(/Typefully:/)).toBeVisible();

    expect(mediaPayloads.length).toBeGreaterThan(0);
    expect(threadPayloads.length).toBeGreaterThan(0);

    const firstThread = threadPayloads[0] as {
      posts?: Array<{ mediaIds?: string[] }>;
    };
    expect(firstThread.posts?.[0]?.mediaIds).toEqual(["media_mock"]);
  });
});
