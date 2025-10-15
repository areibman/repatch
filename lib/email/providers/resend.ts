import { Resend } from "resend";

import { EmailProvider, EmailSubscriber, SendPatchNotePayload } from "../types";
import { getProviderMetadata } from "../metadata";
import { EmailProviderError } from "../errors";

type ResendProviderConfig = {
  apiKey?: string;
  audienceId?: string;
  fromEmail?: string | null;
};

const DEFAULT_AUDIENCE_ID = "fa2a9141-3fa1-4d41-a873-5883074e6516";

function assertConfig(config: ResendProviderConfig): asserts config is Required<Pick<ResendProviderConfig, "apiKey">> & ResendProviderConfig {
  if (!config.apiKey) {
    throw new EmailProviderError(
      "Resend API key is missing.",
      "MISSING_CONFIGURATION"
    );
  }
}

export class ResendProvider implements EmailProvider {
  private client: Resend;
  private config: Required<Pick<ResendProviderConfig, "apiKey">> & ResendProviderConfig;
  readonly id = "resend" as const;
  readonly label = getProviderMetadata("resend").label;
  readonly supportsAudienceManagement = true;
  readonly dashboardUrl = getProviderMetadata("resend").dashboardUrl;

  constructor(config: ResendProviderConfig) {
    assertConfig(config);
    this.config = {
      ...config,
      audienceId: config.audienceId || DEFAULT_AUDIENCE_ID,
    };
    this.client = new Resend(this.config.apiKey);
  }

  private get audienceId() {
    return this.config.audienceId || DEFAULT_AUDIENCE_ID;
  }

  getFromEmail() {
    return this.config.fromEmail ?? getProviderMetadata("resend").defaultFromEmail ?? null;
  }

  getMetadata() {
    return {
      audienceId: this.audienceId,
    };
  }

  async listSubscribers(): Promise<EmailSubscriber[]> {
    try {
      const response = await this.client.contacts.list({
        audienceId: this.audienceId,
      });

      if (!response.data) {
        return [];
      }

      return response.data.data.map((contact: any) => ({
        id: contact.id,
        email: contact.email,
        active: !contact.unsubscribed,
        createdAt: contact.created_at,
        updatedAt: contact.updated_at,
      }));
    } catch (error) {
      throw new EmailProviderError("Failed to fetch Resend contacts.", "REQUEST_FAILED", { cause: error });
    }
  }

  async addSubscriber(
    email: string,
    meta?: { firstName?: string; lastName?: string }
  ): Promise<EmailSubscriber> {
    try {
      const response = await this.client.contacts.create({
        email,
        firstName: meta?.firstName || "",
        lastName: meta?.lastName || "",
        audienceId: this.audienceId,
        unsubscribed: false,
      });

      if (!response.data) {
        throw new EmailProviderError(
          "Resend did not return subscriber data.",
          "REQUEST_FAILED"
        );
      }

      return {
        id: response.data.id,
        email,
        active: true,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
      };
    } catch (error) {
      if (error instanceof Error && /already exists/i.test(error.message)) {
        throw error;
      }

      throw new EmailProviderError("Failed to add subscriber to Resend.", "REQUEST_FAILED", { cause: error });
    }
  }

  async updateSubscriber(params: {
    email?: string;
    id?: string;
    active: boolean;
  }): Promise<EmailSubscriber> {
    try {
      const response = await this.client.contacts.update({
        ...(params.id ? { id: params.id } : { email: params.email ?? "" }),
        audienceId: this.audienceId,
        unsubscribed: !params.active,
      });

      if (!response.data) {
        throw new EmailProviderError(
          "Resend did not return updated subscriber data.",
          "REQUEST_FAILED"
        );
      }

      return {
        id: response.data.id,
        email: response.data.email,
        active: !response.data.unsubscribed,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
      };
    } catch (error) {
      throw new EmailProviderError("Failed to update Resend subscriber.", "REQUEST_FAILED", { cause: error });
    }
  }

  async removeSubscriber(params: { email?: string; id?: string }): Promise<void> {
    try {
      await this.client.contacts.remove({
        ...(params.id ? { id: params.id } : { email: params.email ?? "" }),
        audienceId: this.audienceId,
      });
    } catch (error) {
      throw new EmailProviderError("Failed to remove Resend subscriber.", "REQUEST_FAILED", { cause: error });
    }
  }

  async sendPatchNote({ subject, html, to, previewText }: SendPatchNotePayload) {
    try {
      const response = await this.client.emails.send({
        from: this.getFromEmail() ?? "Repatch <onboarding@resend.dev>",
        to,
        subject,
        html,
        ...(previewText ? { text: previewText } : {}),
      });

      if (response.error) {
        throw response.error;
      }

      return { providerMessageId: response.data?.id };
    } catch (error) {
      throw new EmailProviderError("Failed to send email with Resend.", "REQUEST_FAILED", { cause: error });
    }
  }
}
