import { Resend } from "resend";
import { loadIntegrationFixture } from "@/lib/testing/mock-fixtures";
import { usingMockIntegrations } from "@/lib/testing/test-environment";

export type ResendContact = {
  email: string;
  unsubscribed?: boolean;
};

export type ResendSendPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
};

export type ResendSendResult = {
  id: string;
};

export interface ResendAdapter {
  listAudienceContacts(audienceId: string): Promise<ResendContact[]>;
  sendEmail(payload: ResendSendPayload): Promise<ResendSendResult>;
}

class RealResendAdapter implements ResendAdapter {
  private client: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "RESEND_API_KEY is required when running with live integrations"
      );
    }
    this.client = new Resend(apiKey);
  }

  async listAudienceContacts(audienceId: string) {
    const contacts = await this.client.contacts.list({ audienceId });
    const data = contacts.data?.data ?? [];
    return data as ResendContact[];
  }

  async sendEmail(payload: ResendSendPayload) {
    const { data, error } = await this.client.emails.send(payload);
    if (error) {
      throw error;
    }
    return { id: data?.id ?? "" };
  }
}

const SENT_EMAILS_SYMBOL = Symbol.for("REPATCH_RESEND_SENT_EMAILS");

type GlobalWithSent = typeof globalThis & {
  [SENT_EMAILS_SYMBOL]?: ResendSendPayload[];
};

class MockResendAdapter implements ResendAdapter {
  private sent: ResendSendPayload[];

  constructor() {
    const global = globalThis as GlobalWithSent;
    if (!global[SENT_EMAILS_SYMBOL]) {
      global[SENT_EMAILS_SYMBOL] = [];
    }
    this.sent = global[SENT_EMAILS_SYMBOL]!;
  }

  async listAudienceContacts(_audienceId: string) {
    const fixture = loadIntegrationFixture<{
      data?: { data?: ResendContact[] };
    }>("resend-contacts", { data: { data: [] } });
    return fixture.data?.data ?? [];
  }

  async sendEmail(payload: ResendSendPayload) {
    this.sent.push(payload);
    return { id: "mock-email" };
  }
}

let cachedAdapter: ResendAdapter | null = null;

export function getResendAdapter(): ResendAdapter {
  if (cachedAdapter) {
    return cachedAdapter;
  }
  cachedAdapter = usingMockIntegrations()
    ? new MockResendAdapter()
    : new RealResendAdapter();
  return cachedAdapter;
}

export function getSentMockEmails() {
  const global = globalThis as GlobalWithSent;
  return global[SENT_EMAILS_SYMBOL] ?? [];
}

export function resetSentMockEmails() {
  const global = globalThis as GlobalWithSent;
  if (global[SENT_EMAILS_SYMBOL]) {
    global[SENT_EMAILS_SYMBOL] = [];
  }
}
