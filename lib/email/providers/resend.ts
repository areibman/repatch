import { Resend } from "resend";

import type {
  EmailProvider,
  EmailSendRequest,
  EmailSubscriber,
  ResendProviderConfig,
  SubscriberInput,
  SubscriberLookupInput,
  SubscriberUpdateInput,
} from "@/lib/email/types";

export const RESEND_DEFAULT_AUDIENCE_ID =
  "fa2a9141-3fa1-4d41-a873-5883074e6516";

function mapContact(contact: any): EmailSubscriber {
  return {
    id: contact.id,
    email: contact.email,
    active: !contact.unsubscribed,
    createdAt: contact.created_at ?? new Date().toISOString(),
    updatedAt: contact.updated_at ?? new Date().toISOString(),
    metadata: contact.attributes ?? null,
  };
}

export function createResendProvider(
  config: ResendProviderConfig
): EmailProvider {
  const resend = new Resend(config.apiKey);
  const audienceId = config.audienceId || RESEND_DEFAULT_AUDIENCE_ID;

  return {
    id: "resend",
    displayName: "Resend",

    async listSubscribers(): Promise<EmailSubscriber[]> {
      try {
        const response = await resend.contacts.list({ audienceId });
        const records = response?.data?.data ?? [];
        return records.map(mapContact);
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? error.message
            : "Failed to fetch contacts from Resend"
        );
      }
    },

    async addSubscriber(input: SubscriberInput): Promise<EmailSubscriber> {
      try {
        const response = await resend.contacts.create({
          email: input.email,
          firstName: input.firstName ?? "",
          lastName: input.lastName ?? "",
          unsubscribed: false,
          audienceId,
        });

        if (!response?.data) {
          throw new Error("Resend did not return a contact record");
        }

        return mapContact(response.data);
      } catch (error: any) {
        if (typeof error?.message === "string") {
          if (error.message.includes("already exists")) {
            throw new Error("Email already subscribed");
          }
        }

        throw new Error(
          error instanceof Error
            ? error.message
            : "Failed to add subscriber to Resend"
        );
      }
    },

    async removeSubscriber(input: SubscriberLookupInput): Promise<void> {
      if (!input.id && !input.email) {
        throw new Error("Email or ID parameter is required");
      }

      try {
        await resend.contacts.remove({
          ...(input.id ? { id: input.id } : { email: input.email! }),
          audienceId,
        });
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? error.message
            : "Failed to remove subscriber from Resend"
        );
      }
    },

    async updateSubscriber(
      input: SubscriberUpdateInput
    ): Promise<EmailSubscriber> {
      if (!input.id && !input.email) {
        throw new Error("Email or ID parameter is required");
      }

      try {
        const response = await resend.contacts.update({
          ...(input.id ? { id: input.id } : { email: input.email! }),
          audienceId,
          unsubscribed: input.unsubscribed,
        });

        if (!response?.data) {
          throw new Error("Resend did not return an updated record");
        }

        return mapContact(response.data);
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? error.message
            : "Failed to update subscriber in Resend"
        );
      }
    },

    async sendCampaign(payload: EmailSendRequest) {
      if (!payload.to.length) {
        return { sent: 0, failed: [], metadata: {} };
      }

      try {
        const { data } = await resend.emails.send({
          from: payload.from,
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          ...(payload.text ? { text: payload.text } : {}),
        });

        return {
          sent: payload.to.length,
          failed: [],
          metadata: data ? { id: data.id } : undefined,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to send email via Resend";
        throw new Error(message);
      }
    },
  };
}
