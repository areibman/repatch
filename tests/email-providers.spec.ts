import { test, expect } from "@playwright/test";
import { createResendProvider } from "@/lib/email/providers/resend";
import { createCustomerIoProvider } from "@/lib/email/providers/customerio";
import { createEmailProvider } from "@/lib/email/providers";
import { EmailIntegrationConfig } from "@/lib/email/types";

test("resend provider sends email with provided sender", async () => {
  const sendPayloads: any[] = [];
  const resendConfig: EmailIntegrationConfig = {
    id: "resend",
    credentials: {
      apiKey: "test-key",
      audienceId: "aud_123",
      fromEmail: "Patch Notes <patch@example.com>",
    },
    defaultSender: "Patch Notes <patch@example.com>",
    audienceId: "aud_123",
    source: "supabase",
  };

  const provider = createResendProvider(resendConfig, {
    emailsClient: {
      send: async (payload: any) => {
        sendPayloads.push(payload);
        return { data: { id: "email_123" }, error: null };
      },
    } as any,
    contactsClient: {
      list: async () => ({
        data: {
          data: [
            { id: "1", email: "user@example.com", unsubscribed: false },
            { id: "2", email: "opt-out@example.com", unsubscribed: true },
          ],
        },
      }),
      create: async () => ({ data: { id: "1" } }),
      remove: async () => ({ data: { success: true } }),
      update: async () => ({ data: { id: "1" } }),
    } as any,
  });

  const subscribers = await provider.listSubscribers();
  expect(subscribers).toHaveLength(2);
  const result = await provider.sendEmail({
    from: resendConfig.defaultSender,
    to: ["user@example.com"],
    subject: "Weekly Update",
    html: "<p>Hello</p>",
  });

  expect(result.accepted).toEqual(["user@example.com"]);
  expect(sendPayloads[0].from).toBe(resendConfig.defaultSender);
});

test("customer.io provider lists subscribers and sends individual emails", async () => {
  const apiCalls: any[] = [];
  const config: EmailIntegrationConfig = {
    id: "customerio",
    credentials: {
      siteId: "site_123",
      trackApiKey: "track_key",
      appApiKey: "app_key",
      transactionalMessageId: "msg_001",
      fromEmail: "Updates <updates@example.com>",
    },
    defaultSender: "Updates <updates@example.com>",
    source: "supabase",
  };

  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          customers: [
            {
              id: "1",
              email: "customer@example.com",
              suppressed: false,
              created_at: 1_700_000_000,
            },
          ],
        })
      );

    const provider = createCustomerIoProvider(config, {
      apiClient: {
        sendEmail: async (payload: any) => {
          apiCalls.push(payload);
          return { request_id: "req_1" };
        },
      } as any,
      trackClient: {
        identify: async () => {},
        destroy: async () => {},
        suppress: async () => {},
        unsuppress: async () => {},
      } as any,
    });

    const subscribers = await provider.listSubscribers();
    expect(subscribers).toHaveLength(1);
    expect(subscribers[0].email).toBe("customer@example.com");

    const result = await provider.sendEmail({
      to: ["customer@example.com"],
      subject: "Patch Notes",
      html: "<p>New release</p>",
      text: "New release",
    });

    expect(result.accepted).toEqual(["customer@example.com"]);
    expect(apiCalls).toHaveLength(1);
    expect(apiCalls[0].to.email).toBe("customer@example.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createEmailProvider selects provider implementation", () => {
  const config: EmailIntegrationConfig = {
    id: "resend",
    credentials: { apiKey: "key" },
    defaultSender: undefined,
    source: "supabase",
  };

  const provider = createEmailProvider(config);
  expect(provider.id).toBe("resend");
});
