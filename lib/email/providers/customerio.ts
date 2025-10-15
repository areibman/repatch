import {
  EmailProvider,
  EmailProviderCapabilities,
  EmailProviderName,
  EmailSendRequest,
  EmailSendResult,
} from "../types";
import { Regions, TransactionalClient } from "customerio-node";

export type CustomerioProviderConfig = {
  appApiKey?: string;
  siteId?: string;
  region?: "us" | "eu";
  transactionalApiKey?: string;
  transactionalMessageId?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
};

const DEFAULT_FROM_EMAIL = "updates@repatch.dev";
const DEFAULT_FROM_NAME = "Repatch";

function resolveRegion(region?: string) {
  if (!region) return Regions.US;
  return region.toLowerCase() === "eu" ? Regions.EU : Regions.US;
}

export class CustomerioEmailProvider implements EmailProvider {
  readonly id: EmailProviderName = "customerio";
  readonly label = "Customer.io";
  readonly capabilities: EmailProviderCapabilities = {
    canListSubscribers: false,
    canManageSubscribers: false,
  };

  private readonly config: CustomerioProviderConfig;
  private readonly transactional: TransactionalClient | null;

  constructor(config: CustomerioProviderConfig = {}) {
    this.config = config;
    const transactionalApiKey =
      config.transactionalApiKey?.trim() ||
      process.env.CUSTOMERIO_TRANSACTIONAL_API_KEY?.trim() ||
      "";

    this.transactional = transactionalApiKey
      ? new TransactionalClient(transactionalApiKey)
      : null;
  }

  private ensureTransactional(): TransactionalClient {
    if (!this.transactional) {
      throw new Error("Customer.io transactional API key is not configured");
    }
    return this.transactional;
  }

  private transactionalMessageId(): string {
    const messageId =
      this.config.transactionalMessageId?.trim() ||
      process.env.CUSTOMERIO_TRANSACTIONAL_MESSAGE_ID?.trim();
    if (!messageId) {
      throw new Error("Customer.io transactional message ID is not configured");
    }
    return messageId;
  }

  getFromAddress() {
    const email =
      this.config.fromEmail?.trim() ||
      process.env.CUSTOMERIO_FROM_EMAIL?.trim() ||
      DEFAULT_FROM_EMAIL;
    const name =
      this.config.fromName?.trim() ||
      process.env.CUSTOMERIO_FROM_NAME?.trim() ||
      DEFAULT_FROM_NAME;
    return { email, name };
  }

  private replyToAddress() {
    return (
      this.config.replyTo?.trim() ||
      process.env.CUSTOMERIO_REPLY_TO?.trim() ||
      undefined
    );
  }

  async sendEmail(payload: EmailSendRequest): Promise<EmailSendResult> {
    const transactional = this.ensureTransactional();
    const messageId = this.transactionalMessageId();
    const from = payload.from ?? this.getFromAddress();
    const replyTo = payload.replyTo ?? this.replyToAddress();

    const deliveries = [] as Array<{ delivery_id?: string; id?: string }>;

    for (const recipient of payload.to) {
      const response = await transactional.sendEmail({
        to: recipient,
        transactional_message_id: messageId,
        message_data: {
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          from_email: from.email,
          from_name: from.name,
          preview_text: payload.previewText,
          reply_to: replyTo,
        },
        identifiers: {
          email: recipient,
        },
      });
      deliveries.push(response);
    }

    const deliveryId = deliveries
      .map((entry) => entry.delivery_id ?? entry.id)
      .filter(Boolean)
      .join(",");

    return {
      id: deliveryId || undefined,
      provider: this.id,
      metadata: {
        recipients: payload.to.length,
        region: resolveRegion(this.config.region || process.env.CUSTOMERIO_REGION),
      },
    };
  }
}
