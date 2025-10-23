import { Resend } from "resend";
import type {
  EmailProvider,
  EmailProviderContext,
  EmailSubscriber,
} from "../types";

type ResendSettings = {
  apiKey?: string;
  audienceId?: string;
  fromEmail?: string;
  fromName?: string;
};

const DEFAULT_AUDIENCE_ID = "fa2a9141-3fa1-4d41-a873-5883074e6516";

export class ResendProvider implements EmailProvider {
  public readonly id = "resend" as const;
  public readonly displayName = "Resend";

  private client: Resend;
  private settings: ResendSettings;

  constructor(settings: ResendSettings = {}, _context: EmailProviderContext = {}) {
    const apiKey = settings.apiKey || process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error("Resend API key is not configured.");
    }

    this.client = new Resend(apiKey);
    this.settings = settings;
  }

  private get audienceId(): string {
    return (
      this.settings.audienceId ||
      process.env.RESEND_AUDIENCE_ID ||
      DEFAULT_AUDIENCE_ID
    );
  }

  private get fromAddress(): string {
    const fromEmail =
      this.settings.fromEmail ||
      process.env.RESEND_FROM_EMAIL ||
      "patch-notes@example.com";
    const fromName =
      this.settings.fromName ||
      process.env.RESEND_FROM_NAME ||
      "Patch Notes";

    return `${fromName} <${fromEmail}>`;
  }

  async listSubscribers(): Promise<EmailSubscriber[]> {
    const contacts = await this.client.contacts.list({
      audienceId: this.audienceId,
    });

    if (!contacts.data) {
      return [];
    }

    return contacts.data.data.map((contact: any) => ({
      id: contact.id,
      email: contact.email,
      active: !contact.unsubscribed,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    }));
  }

  async createSubscriber(input: {
    email: string;
    firstName?: string;
    lastName?: string;
  }): Promise<EmailSubscriber> {
    const created = await this.client.contacts.create({
      audienceId: this.audienceId,
      email: input.email,
      firstName: input.firstName ?? "",
      lastName: input.lastName ?? "",
      unsubscribed: false,
    });

    const now = new Date().toISOString();

    return {
      id: created.data?.id ?? input.email,
      email: input.email,
      active: true,
      createdAt: created.data?.created_at ?? now,
      updatedAt: created.data?.updated_at ?? now,
    };
  }

  async updateSubscriber(input: {
    id?: string;
    email?: string;
    unsubscribed?: boolean;
  }): Promise<EmailSubscriber> {
    const result = await this.client.contacts.update({
      audienceId: this.audienceId,
      ...(input.id ? { id: input.id } : { email: input.email }),
      unsubscribed: input.unsubscribed ?? false,
    });

    const now = new Date().toISOString();

    return {
      id: result.data?.id ?? input.id ?? input.email ?? "",
      email: input.email ?? input.id ?? "",
      active: !(input.unsubscribed ?? false),
      createdAt: result.data?.created_at ?? now,
      updatedAt: result.data?.updated_at ?? now,
    };
  }

  async removeSubscriber(input: {
    id?: string;
    email?: string;
  }): Promise<void> {
    await this.client.contacts.remove({
      audienceId: this.audienceId,
      ...(input.id ? { id: input.id } : { email: input.email! }),
    });
  }

  async sendCampaign(input: {
    subject: string;
    html: string;
    text?: string;
    previewText?: string;
    recipients: string[];
  }): Promise<{ sentTo: number }> {
    if (!input.recipients.length) {
      return { sentTo: 0 };
    }

    await this.client.emails.send({
      from: this.fromAddress,
      to: input.recipients,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.previewText
        ? { headers: { "X-Preview-Text": input.previewText } }
        : {}),
    });

    return { sentTo: input.recipients.length };
  }
}

export type { ResendSettings };
