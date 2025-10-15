import { Resend } from "resend";
import {
  EmailIntegrationConfig,
  EmailProvider,
  EmailSubscriber,
  SendEmailOptions,
  SendEmailResult,
  SubscriberIdentifier,
} from "../types";

const DEFAULT_RESEND_AUDIENCE = "fa2a9141-3fa1-4d41-a873-5883074e6516";
const DEFAULT_RESEND_SENDER = "Repatch <onboarding@resend.dev>";

type ResendContactsClient = Resend["contacts"];

type ResendEmailsClient = Resend["emails"];

interface ResendProviderDependencies {
  contactsClient?: ResendContactsClient;
  emailsClient?: ResendEmailsClient;
}

export function createResendProvider(
  config: EmailIntegrationConfig,
  deps: ResendProviderDependencies = {}
): EmailProvider {
  const apiKey = config.credentials.apiKey || process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Resend provider is missing an API key");
  }

  const resend = new Resend(apiKey);

  const contacts = deps.contactsClient ?? resend.contacts;
  const emails = deps.emailsClient ?? resend.emails;

  const audienceId =
    config.audienceId ||
    config.credentials.audienceId ||
    process.env.RESEND_AUDIENCE_ID ||
    DEFAULT_RESEND_AUDIENCE;

  const defaultSender =
    config.defaultSender || config.credentials.fromEmail || DEFAULT_RESEND_SENDER;

  const provider: EmailProvider = {
    id: "resend",
    name: "Resend",
    async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
      if (!options.to.length) {
        return {
          id: undefined,
          accepted: [],
          rejected: [],
          provider: "resend",
        };
      }

      const { data, error } = await emails.send({
        from: options.from ?? defaultSender,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
      } as any);

      if (error) {
        throw new Error(error.message ?? "Resend failed to send email");
      }

      return {
        id: data?.id,
        accepted: options.to,
        rejected: [],
        provider: "resend",
      };
    },
    async listSubscribers(): Promise<EmailSubscriber[]> {
      const response = await contacts.list({ audienceId });

      if (!response.data) {
        return [];
      }

      return response.data.data.map((contact: any) => ({
        id: String(contact.id),
        email: contact.email,
        active: !contact.unsubscribed,
        createdAt: contact.created_at,
        updatedAt: contact.updated_at,
        raw: contact,
      }));
    },
    async addSubscriber(
      email: string,
      properties: Record<string, string | number | boolean | null> = {}
    ): Promise<EmailSubscriber> {
      const response = await contacts.create({
        email,
        audienceId,
        unsubscribed: false,
        ...properties,
      } as any);

      if (!response.data) {
        throw new Error("Failed to add subscriber in Resend");
      }

      return {
        id: String(response.data.id),
        email,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        raw: response.data,
      };
    },
    async removeSubscriber(identifier: SubscriberIdentifier): Promise<void> {
      const payload: Record<string, string> = { audienceId };

      if (identifier.id) {
        payload.id = identifier.id;
      }

      if (identifier.email) {
        payload.email = identifier.email;
      }

      if (!payload.id && !payload.email) {
        throw new Error("Resend removal requires an id or email");
      }

      const result = await contacts.remove(payload as any);

      if (!result.data) {
        throw new Error("Failed to remove subscriber in Resend");
      }
    },
    async updateSubscriber(
      identifier: SubscriberIdentifier,
      properties: { active?: boolean } & Record<string, unknown>
    ): Promise<EmailSubscriber> {
      const payload: Record<string, unknown> = {
        audienceId,
      };

      if (identifier.id) {
        payload.id = identifier.id;
      }

      if (identifier.email) {
        payload.email = identifier.email;
      }

      if (!payload.id && !payload.email) {
        throw new Error("Resend update requires an id or email");
      }

      if (typeof properties.active === "boolean") {
        payload.unsubscribed = !properties.active;
      }

      const result = await contacts.update(payload as any);

      if (!result.data) {
        throw new Error("Failed to update subscriber in Resend");
      }

      return {
        id: String(result.data.id ?? identifier.id ?? identifier.email ?? ""),
        email: String(identifier.email ?? identifier.id ?? ""),
        active: !(payload.unsubscribed as boolean | undefined),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        raw: result.data,
      };
    },
    getManageUrl() {
      return "https://resend.com";
    },
  };

  return provider;
}
