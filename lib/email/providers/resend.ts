import { Resend } from "resend";
import {
  AddSubscriberPayload,
  EmailProvider,
  EmailSubscriber,
  RemoveSubscriberPayload,
  SendEmailPayload,
  SendEmailResult,
  UpdateSubscriberPayload,
} from "../types";

type ResendProviderOptions = {
  apiKey: string;
  audienceId: string;
  fromEmail: string;
  manageUrl?: string;
};

type ResendClient = {
  contacts: {
    list: (params: { audienceId: string }) => Promise<any>;
    create: (params: Record<string, unknown>) => Promise<any>;
    update: (params: Record<string, unknown>) => Promise<any>;
    remove: (params: Record<string, unknown>) => Promise<any>;
  };
  emails: {
    send: (params: Record<string, unknown>) => Promise<any>;
  };
};

export class ResendEmailProvider implements EmailProvider {
  public readonly name = "resend" as const;
  public readonly manageUrl: string;
  private readonly client: ResendClient;
  private readonly audienceId: string;
  public readonly fromEmail: string;

  constructor(options: ResendProviderOptions, client?: ResendClient) {
    this.manageUrl = options.manageUrl ?? "https://resend.com";
    this.audienceId = options.audienceId;
    this.fromEmail = options.fromEmail;
    this.client = client ?? ((new Resend(options.apiKey)) as unknown as ResendClient);
  }

  async listSubscribers(): Promise<EmailSubscriber[]> {
    const contacts = await this.client.contacts.list({
      audienceId: this.audienceId,
    });

    if (!contacts.data) {
      throw new Error("Failed to fetch subscribers from Resend");
    }

    return contacts.data.data.map((contact: any) => ({
      id: contact.id,
      email: contact.email,
      active: !contact.unsubscribed,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    }));
  }

  async addSubscriber(payload: AddSubscriberPayload): Promise<EmailSubscriber> {
    const result = await this.client.contacts.create({
      audienceId: this.audienceId,
      email: payload.email,
      firstName: payload.firstName ?? "",
      lastName: payload.lastName ?? "",
      unsubscribed: false,
    });

    if (!result.data) {
      throw new Error("Failed to add subscriber to Resend");
    }

    const now = new Date().toISOString();
    return {
      id: result.data.id,
      email: payload.email,
      active: true,
      createdAt: result.data.created_at ?? now,
      updatedAt: result.data.updated_at ?? now,
    };
  }

  async updateSubscriber(
    payload: UpdateSubscriberPayload
  ): Promise<EmailSubscriber> {
    if (!payload.id && !payload.email) {
      throw new Error("Email or ID is required to update a subscriber");
    }

    const result = await this.client.contacts.update({
      ...(payload.id ? { id: payload.id } : { email: payload.email }),
      audienceId: this.audienceId,
      unsubscribed: payload.unsubscribed ?? false,
    });

    if (!result.data) {
      throw new Error("Failed to update subscriber in Resend");
    }

    return {
      id: result.data.id,
      email: payload.email ?? result.data.email,
      active: !(payload.unsubscribed ?? false),
      createdAt: result.data.created_at,
      updatedAt: result.data.updated_at,
    };
  }

  async removeSubscriber(payload: RemoveSubscriberPayload): Promise<void> {
    if (!payload.id && !payload.email) {
      throw new Error("Email or ID is required to remove a subscriber");
    }

    const response = await this.client.contacts.remove({
      ...(payload.id ? { id: payload.id } : { email: payload.email! }),
      audienceId: this.audienceId,
    });

    if (!response.data) {
      throw new Error("Failed to remove subscriber from Resend");
    }
  }

  async sendCampaign(payload: SendEmailPayload): Promise<SendEmailResult> {
    if (payload.recipients.length === 0) {
      throw new Error("At least one recipient is required to send email");
    }

    const response = await this.client.emails.send({
      from: this.fromEmail,
      to: payload.recipients,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      ...(payload.previewText ? { headers: { "X-Preview-Text": payload.previewText } } : {}),
    } as any);

    const messageId = (response as any)?.data?.id ?? "";

    return {
      id: messageId,
      deliveredTo: payload.recipients,
    };
  }
}
