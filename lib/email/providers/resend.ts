import { Resend } from "resend";
import {
  type AddSubscriberPayload,
  type EmailProvider,
  type EmailProviderName,
  type EmailSendResult,
  type EmailSubscriber,
  type RemoveSubscriberPayload,
  type SendPatchNoteOptions,
  type UpdateSubscriberPayload,
  type EmailIntegrationSettings,
} from "@/lib/email/types";

const DEFAULT_AUDIENCE_ID =
  process.env.RESEND_AUDIENCE_ID ?? "fa2a9141-3fa1-4d41-a873-5883074e6516";

export class ResendEmailProvider implements EmailProvider {
  readonly name: EmailProviderName = "resend";
  readonly config: EmailIntegrationSettings;
  private readonly client: Resend;

  constructor(config: EmailIntegrationSettings) {
    if (!config.apiKey) {
      throw new Error("Missing Resend API key");
    }

    const audienceId = config.audienceId ?? DEFAULT_AUDIENCE_ID;

    if (!audienceId) {
      throw new Error("Missing Resend audience identifier");
    }

    const fromEmail = config.fromEmail || "Repatch <onboarding@resend.dev>";

    this.config = {
      ...config,
      audienceId,
      fromEmail,
    };

    this.client = new Resend(config.apiKey);
  }

  private get audienceId() {
    return this.config.audienceId ?? DEFAULT_AUDIENCE_ID;
  }

  async listSubscribers(): Promise<EmailSubscriber[]> {
    const response = await this.client.contacts.list({
      audienceId: this.audienceId,
    });

    if (!response.data) {
      throw new Error("Resend returned no contact data");
    }

    const contacts = Array.isArray(response.data.data)
      ? response.data.data
      : [];

    return contacts.map((contact: any) => ({
      id: String(contact.id),
      email: contact.email,
      active: !contact.unsubscribed,
      createdAt: contact.created_at ?? new Date().toISOString(),
      updatedAt: contact.updated_at ?? new Date().toISOString(),
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
      throw new Error("Failed to create Resend contact");
    }

    return {
      id: String(result.data.id),
      email: payload.email,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async updateSubscriber(
    payload: UpdateSubscriberPayload
  ): Promise<EmailSubscriber> {
    if (!payload.id && !payload.email) {
      throw new Error("Resend update requires an id or email");
    }

    const result = await this.client.contacts.update({
      ...(payload.id ? { id: payload.id } : { email: payload.email! }),
      audienceId: this.audienceId,
      unsubscribed: payload.unsubscribed ?? false,
    });

    if (!result.data) {
      throw new Error("Failed to update Resend contact");
    }

    return {
      id: String(result.data.id),
      email: payload.email ?? String(result.data.id),
      active: !(payload.unsubscribed ?? false),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async removeSubscriber(payload: RemoveSubscriberPayload): Promise<void> {
    if (!payload.id && !payload.email) {
      throw new Error("Resend removal requires an id or email");
    }

    const result = await this.client.contacts.remove({
      ...(payload.id ? { id: payload.id } : { email: payload.email! }),
      audienceId: this.audienceId,
    });

    if (!result.data) {
      throw new Error("Failed to remove Resend contact");
    }
  }

  async sendPatchNoteEmail(
    options: SendPatchNoteOptions
  ): Promise<EmailSendResult> {
    if (!options.recipients.length) {
      throw new Error("No recipients provided");
    }

    const response = await this.client.emails.send({
      from: this.config.fromEmail,
      to: options.recipients.map((recipient) => recipient.email),
      subject: options.subject,
      html: options.html,
      ...(options.previewText
        ? { headers: { "X-Preheader": options.previewText } }
        : {}),
    });

    if (response.error) {
      throw new Error(response.error.message ?? "Resend send failure");
    }

    return {
      totalRecipients: options.recipients.length,
      providerMessageIds: response.data?.id ? [response.data.id] : [],
    };
  }
}

export function createResendProvider(
  config: EmailIntegrationSettings
): ResendEmailProvider {
  return new ResendEmailProvider(config);
}
