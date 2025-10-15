import { test, expect } from "@playwright/test";
import {
  createEmailProviderFromIntegration,
  resolveActiveIntegration,
  sanitizeIntegration,
} from "@/lib/email";
import { ResendEmailProvider } from "@/lib/email/providers/resend";
import { CustomerIOEmailProvider } from "@/lib/email/providers/customerio";
import type { EmailIntegrationRecord } from "@/lib/email";

test("resolveActiveIntegration prefers fallback when no provider is active", () => {
  const integrations: EmailIntegrationRecord[] = [
    {
      provider: "customerio",
      fromEmail: "ops@example.com",
      credentials: {},
      isActive: false,
    },
  ];

  const fallback: EmailIntegrationRecord = {
    provider: "resend",
    fromEmail: "Repatch <updates@example.com>",
    credentials: { apiKey: "resend-key", audienceId: "aud" },
    isActive: true,
    isFallback: true,
  };

  const active = resolveActiveIntegration(integrations, fallback);
  expect(active).toEqual(fallback);
});

test("sanitizeIntegration exposes manage URL for customerio", () => {
  const integration: EmailIntegrationRecord = {
    provider: "customerio",
    fromEmail: "Patch <patch@example.com>",
    credentials: {},
    isActive: true,
  };

  const sanitized = sanitizeIntegration(integration);
  expect(sanitized.manageUrl).toContain("customer.io");
});

test("Resend provider sends campaign to all recipients", async () => {
  const sendPayloads: Record<string, unknown>[] = [];

  const provider = new ResendEmailProvider(
    {
      apiKey: "test-resend-key",
      audienceId: "aud-123",
      fromEmail: "Patch <patch@example.com>",
    },
    {
      contacts: {
        list: async () => ({ data: { data: [] } }),
        create: async () => ({ data: {} }),
        update: async () => ({ data: {} }),
        remove: async () => ({ data: {} }),
      },
      emails: {
        send: async (payload: Record<string, unknown>) => {
          sendPayloads.push(payload);
          return { data: { id: "email_123" } } as any;
        },
      },
    }
  );

  const result = await provider.sendCampaign({
    subject: "Weekly Patch",
    html: "<p>Hello</p>",
    text: "Hello",
    recipients: ["a@example.com", "b@example.com"],
  });

  expect(result.deliveredTo).toEqual(["a@example.com", "b@example.com"]);
  expect(sendPayloads).toHaveLength(1);
  expect(sendPayloads[0].to).toEqual(["a@example.com", "b@example.com"]);
});

test("Customer.io provider sends transactional email", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const http = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });

    if (url.includes("/customers?")) {
      return new Response(
        JSON.stringify({ customers: [{ id: "abc", email: "demo@example.com" }] }),
        { status: 200 }
      );
    }

    if (url.endsWith("/send/email")) {
      return new Response(JSON.stringify({ id: "msg_123" }), { status: 200 });
    }

    if (url.includes("/customers/") && (!init || init.method === "GET")) {
      return new Response(
        JSON.stringify({
          customer: {
            id: "demo@example.com",
            email: "demo@example.com",
            created_at: Math.floor(Date.now() / 1000),
          },
        }),
        { status: 200 }
      );
    }

    return new Response("{}", { status: 200 });
  };

  const provider = new CustomerIOEmailProvider(
    {
      siteId: "site-id",
      apiKey: "api-key",
      appKey: "app-key",
      transactionalMessageId: "tmpl-123",
      fromEmail: "Patch <patch@example.com>",
      region: "us",
    },
    http as any
  );

  const result = await provider.sendCampaign({
    subject: "Patch",
    html: "<p>body</p>",
    text: "body",
    recipients: ["demo@example.com"],
  });

  expect(result.deliveredTo).toEqual(["demo@example.com"]);
  const sendCall = calls.find((call) => call.url.endsWith("/send/email"));
  expect(sendCall).toBeDefined();
  const payload = JSON.parse(sendCall!.init?.body as string);
  expect(payload.transactional_message_id).toBe("tmpl-123");
  expect(payload.to.email ?? payload.to?.email).toBe("demo@example.com");
});

test("createEmailProviderFromIntegration instantiates Customer.io provider", () => {
  const integration: EmailIntegrationRecord = {
    provider: "customerio",
    fromEmail: "Patch <patch@example.com>",
    credentials: {
      siteId: "site",
      apiKey: "api",
      appKey: "app",
      transactionalMessageId: "tmpl",
      region: "eu",
    },
    isActive: true,
  };

  const provider = createEmailProviderFromIntegration(integration);
  expect(provider.name).toBe("customerio");
  expect(provider.fromEmail).toContain("Patch");
});
