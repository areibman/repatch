import { EmailProvider, EmailSubscriber, SendPatchNotePayload } from "../types";
import { EmailProviderError } from "../errors";
import { getProviderMetadata } from "../metadata";

type MockOptions = {
  id?: "resend" | "customerio";
  label?: string;
  fromEmail?: string;
  dashboardUrl?: string;
};

const subscriberStores: Record<string, EmailSubscriber[]> = {};

function createDefaultSubscribers(): EmailSubscriber[] {
  const now = new Date().toISOString();
  return [
    {
      id: "mock-1",
      email: "mock-subscriber@example.com",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "mock-2",
      email: "inactive@example.com",
      active: false,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export class MockEmailProvider implements EmailProvider {
  readonly id: "resend" | "customerio";
  readonly label: string;
  readonly supportsAudienceManagement = true;
  readonly dashboardUrl: string;
  private fromEmail: string;
  private store: EmailSubscriber[];

  constructor(options: MockOptions = {}) {
    this.id = options.id ?? "resend";
    const metadata = getProviderMetadata(this.id);
    this.label = options.label ?? `${metadata.label} (Mock)`;
    this.dashboardUrl = options.dashboardUrl ?? metadata.dashboardUrl;
    this.fromEmail = options.fromEmail ?? `${metadata.label.toLowerCase()}@mock.test`;
    this.store = subscriberStores[this.id] ||= createDefaultSubscribers();
  }

  getFromEmail() {
    return this.fromEmail;
  }

  getMetadata() {
    return { mock: true };
  }

  async listSubscribers(): Promise<EmailSubscriber[]> {
    return [...this.store];
  }

  async addSubscriber(email: string): Promise<EmailSubscriber> {
    const existing = this.store.find((subscriber) => subscriber.email === email);
    if (existing) {
      throw new EmailProviderError("Subscriber already exists", "REQUEST_FAILED");
    }

    const subscriber: EmailSubscriber = {
      id: `mock-${Date.now()}`,
      email,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.push(subscriber);
    return subscriber;
  }

  async updateSubscriber(params: {
    email?: string;
    id?: string;
    active: boolean;
  }): Promise<EmailSubscriber> {
    const subscriber = this.store.find((entry) =>
      params.id ? entry.id === params.id : entry.email === params.email
    );

    if (!subscriber) {
      throw new EmailProviderError("Subscriber not found", "REQUEST_FAILED");
    }

    subscriber.active = params.active;
    subscriber.updatedAt = new Date().toISOString();
    return { ...subscriber };
  }

  async removeSubscriber(params: { email?: string; id?: string }): Promise<void> {
    const index = this.store.findIndex((entry) =>
      params.id ? entry.id === params.id : entry.email === params.email
    );

    if (index === -1) {
      throw new EmailProviderError("Subscriber not found", "REQUEST_FAILED");
    }

    this.store.splice(index, 1);
  }

  async sendPatchNote(_: SendPatchNotePayload) {
    return { providerMessageId: `mock-${Date.now()}` };
  }
}
