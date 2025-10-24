import { Resend } from "resend";
import type { EmailSubscriber, ResendSettings, SendEmailOptions, SendEmailResult } from "@/types/email";
import type { EmailProviderAdapter } from "./base";

function resolveAudienceId(settings: ResendSettings): string {
  return (
    settings.audienceId ??
    process.env.RESEND_AUDIENCE_ID ??
    "fa2a9141-3fa1-4d41-a873-5883074e6516"
  );
}

function normalizeSubscriber(contact: any): EmailSubscriber {
  return {
    id: String(contact.id),
    email: contact.email,
    active: !contact.unsubscribed,
    createdAt: contact.created_at ?? contact.createdAt ?? undefined,
    updatedAt: contact.updated_at ?? contact.updatedAt ?? undefined,
  };
}

export function createResendAdapter(settings: ResendSettings): EmailProviderAdapter {
  const apiKey = settings.apiKey ?? process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Resend API key is not configured");
  }

  const resend = new Resend(apiKey);
  const audienceId = resolveAudienceId(settings);

  const fromEmail = settings.fromEmail ?? process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const fromName = settings.fromName ?? process.env.RESEND_FROM_NAME ?? "Repatch";

  async function ensureAudiencePresent() {
    if (!audienceId) {
      throw new Error("Resend audience ID is not configured");
    }
  }

  return {
    id: "resend",
    label: "Resend",
    managementUrl: "https://resend.com",
    async listSubscribers() {
      await ensureAudiencePresent();
      const contacts = await resend.contacts.list({ audienceId });

      if (!contacts.data) {
        throw new Error("Failed to fetch contacts from Resend");
      }

      return contacts.data.data.map(normalizeSubscriber);
    },
    async createSubscriber({ email, firstName = "", lastName = "" }) {
      await ensureAudiencePresent();
      const response = await resend.contacts.create({
        email,
        firstName,
        lastName,
        unsubscribed: false,
        audienceId,
      });

      if (!response.data) {
        throw new Error("Failed to add contact to Resend audience");
      }

      return {
        id: String(response.data.id),
        email,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
    async updateSubscriber({ id, email, active }) {
      await ensureAudiencePresent();
      const result = await resend.contacts.update({
        ...(id ? { id } : { email }),
        audienceId,
        unsubscribed: !active,
      });

      if (!result.data) {
        throw new Error("Failed to update contact in Resend audience");
      }

      return {
        id: String(result.data.id),
        email: email ?? String(result.data.id),
        active,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
    async deleteSubscriber({ id, email }) {
      await ensureAudiencePresent();
      await resend.contacts.remove({
        ...(id ? { id } : { email: email! }),
        audienceId,
      });
    },
    async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
      await ensureAudiencePresent();
      const { to, subject, html, text } = options;

      const { data, error } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        reply_to: settings.replyTo ?? process.env.RESEND_REPLY_TO ?? undefined,
        to,
        subject,
        html,
        text,
      });

      if (error) {
        throw new Error(error.message ?? "Resend failed to send email");
      }

      return {
        id: data?.id,
        provider: "resend",
        deliveredTo: to.length,
      };
    },
  };
}
