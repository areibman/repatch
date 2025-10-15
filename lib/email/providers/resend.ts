import { Resend } from "resend";
import {
  EmailProvider,
  EmailProviderCapabilities,
  EmailProviderName,
  EmailSendRequest,
  EmailSendResult,
  EmailSubscriber,
  EmailSubscriberInput,
  EmailSubscriberUpdate,
} from "../types";

export type ResendProviderConfig = {
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  audienceId?: string;
};

const DEFAULT_AUDIENCE_ID = "fa2a9141-3fa1-4d41-a873-5883074e6516";
const DEFAULT_FROM_EMAIL = "onboarding@resend.dev";
const DEFAULT_FROM_NAME = "Repatch";

export class ResendEmailProvider implements EmailProvider {
  readonly id: EmailProviderName = "resend";
  readonly label = "Resend";
  readonly capabilities: EmailProviderCapabilities = {
    canListSubscribers: true,
    canManageSubscribers: true,
  };

  private readonly config: ResendProviderConfig;
  private readonly resend: Resend | null;

  constructor(config: ResendProviderConfig = {}) {
    this.config = config;
    const apiKey =
      config.apiKey?.trim() || process.env.RESEND_API_KEY?.trim() || "";
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  private ensureClient(): Resend {
    if (!this.resend) {
      throw new Error("Resend API key is not configured");
    }
    return this.resend;
  }

  private audienceId(): string {
    return (
      this.config.audienceId?.trim() ||
      process.env.RESEND_AUDIENCE_ID?.trim() ||
      DEFAULT_AUDIENCE_ID
    );
  }

  getFromAddress() {
    const email =
      this.config.fromEmail?.trim() ||
      process.env.RESEND_FROM_EMAIL?.trim() ||
      DEFAULT_FROM_EMAIL;
    const name =
      this.config.fromName?.trim() || process.env.RESEND_FROM_NAME?.trim() || DEFAULT_FROM_NAME;

    return { email, name };
  }

  async sendEmail(payload: EmailSendRequest): Promise<EmailSendResult> {
    const client = this.ensureClient();
    const from = payload.from ?? this.getFromAddress();

    const response = await client.emails.send({
      from: from.name ? `${from.name} <${from.email}>` : from.email,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      reply_to: payload.replyTo,
    });

    if (response.error) {
      throw new Error(response.error.message ?? "Resend failed to send email");
    }

    return {
      id: response.data?.id,
      provider: this.id,
      metadata: response.data ? { status: response.data.status } : undefined,
    };
  }

  async listSubscribers(): Promise<EmailSubscriber[]> {
    const client = this.ensureClient();
    const result = await client.contacts.list({
      audienceId: this.audienceId(),
    });

    if (!result.data) {
      return [];
    }

    return result.data.data.map((contact: any) => ({
      id: contact.id,
      email: contact.email,
      active: !contact.unsubscribed,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    }));
  }

  async createSubscriber(subscriber: EmailSubscriberInput): Promise<void> {
    const client = this.ensureClient();
    await client.contacts.create({
      email: subscriber.email,
      firstName: subscriber.firstName,
      lastName: subscriber.lastName,
      audienceId: this.audienceId(),
      unsubscribed: false,
    });
  }

  async updateSubscriber(update: EmailSubscriberUpdate): Promise<void> {
    const client = this.ensureClient();
    await client.contacts.update({
      email: update.email,
      audienceId: this.audienceId(),
      unsubscribed: update.active === undefined ? undefined : !update.active,
    });
  }

  async deleteSubscriber(email: string): Promise<void> {
    const client = this.ensureClient();
    await client.contacts.remove({
      email,
      audienceId: this.audienceId(),
    });
  }
}
