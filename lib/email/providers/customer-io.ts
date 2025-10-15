import { EmailProvider, EmailSubscriber, SendPatchNotePayload } from "../types";
import { getProviderMetadata } from "../metadata";
import { EmailProviderError } from "../errors";

type CustomerIoProviderConfig = {
  siteId?: string;
  apiKey?: string;
  appKey?: string;
  transactionalMessageId?: string;
  region?: "us" | "eu" | string;
  fromEmail?: string | null;
};

const TRACK_BASE: Record<string, string> = {
  us: "https://track.customer.io/api/v1",
  eu: "https://track-eu.customer.io/api/v1",
};

const APP_BASE: Record<string, string> = {
  us: "https://api.customer.io/v1/api",
  eu: "https://api-eu.customer.io/v1/api",
};

const TRANSACTIONAL_BASE: Record<string, string> = {
  us: "https://api.customer.io/v1",
  eu: "https://api-eu.customer.io/v1",
};

function assertConfig(config: CustomerIoProviderConfig): asserts config is Required<
  Pick<CustomerIoProviderConfig, "siteId" | "apiKey" | "appKey" | "transactionalMessageId">
> & CustomerIoProviderConfig {
  if (!config.siteId || !config.apiKey || !config.appKey || !config.transactionalMessageId) {
    throw new EmailProviderError(
      "Customer.io credentials are incomplete.",
      "MISSING_CONFIGURATION"
    );
  }
}

export class CustomerIoProvider implements EmailProvider {
  readonly id = "customerio" as const;
  readonly label = getProviderMetadata("customerio").label;
  readonly supportsAudienceManagement = true;
  readonly dashboardUrl = getProviderMetadata("customerio").dashboardUrl;
  private config: Required<
    Pick<CustomerIoProviderConfig, "siteId" | "apiKey" | "appKey" | "transactionalMessageId">
  > & CustomerIoProviderConfig;

  constructor(config: CustomerIoProviderConfig) {
    assertConfig(config);
    this.config = {
      ...config,
      region: (config.region || "us").toLowerCase(),
    };
  }

  private get region() {
    return (this.config.region || "us").toLowerCase();
  }

  private get trackBase() {
    return TRACK_BASE[this.region] || TRACK_BASE.us;
  }

  private get appBase() {
    return APP_BASE[this.region] || APP_BASE.us;
  }

  private get transactionalBase() {
    return TRANSACTIONAL_BASE[this.region] || TRANSACTIONAL_BASE.us;
  }

  private get trackAuthHeader() {
    const credentials = Buffer.from(`${this.config.siteId}:${this.config.apiKey}`).toString("base64");
    return `Basic ${credentials}`;
  }

  private async request(
    url: string,
    init: RequestInit & { expectJson?: boolean } = {}
  ): Promise<any> {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new EmailProviderError(
        `Customer.io request failed with status ${response.status}.`,
        "REQUEST_FAILED",
        { cause: body }
      );
    }

    if (init.expectJson === false || response.status === 204) {
      return null;
    }

    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  getFromEmail() {
    return this.config.fromEmail ?? null;
  }

  getMetadata() {
    return {
      transactionalMessageId: this.config.transactionalMessageId,
      region: this.region,
      siteId: this.config.siteId,
    };
  }

  async listSubscribers(): Promise<EmailSubscriber[]> {
    try {
      const result = await this.request(`${this.appBase}/customers?limit=200`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.appKey}`,
        },
      });

      if (!result || !Array.isArray(result.customers)) {
        return [];
      }

      return result.customers.map((customer: any) => ({
        id: customer.id?.toString() ?? customer.email,
        email: customer.email,
        active: !customer.suppressed,
        createdAt: customer.created_at ? new Date(customer.created_at * 1000).toISOString() : undefined,
        updatedAt: customer.updated_at ? new Date(customer.updated_at * 1000).toISOString() : undefined,
      }));
    } catch (error) {
      throw new EmailProviderError("Failed to load Customer.io subscribers.", "REQUEST_FAILED", { cause: error });
    }
  }

  async addSubscriber(
    email: string,
    meta?: { firstName?: string; lastName?: string }
  ): Promise<EmailSubscriber> {
    try {
      await this.request(`${this.trackBase}/customers/${encodeURIComponent(email)}`, {
        method: "PUT",
        headers: {
          Authorization: this.trackAuthHeader,
        },
        body: JSON.stringify({
          email,
          first_name: meta?.firstName,
          last_name: meta?.lastName,
          unsubscribed: false,
        }),
        expectJson: false,
      });

      return {
        id: email,
        email,
        active: true,
      };
    } catch (error) {
      throw new EmailProviderError("Failed to create Customer.io subscriber.", "REQUEST_FAILED", { cause: error });
    }
  }

  async updateSubscriber(params: {
    email?: string;
    id?: string;
    active: boolean;
  }): Promise<EmailSubscriber> {
    const identifier = params.email ?? params.id;
    if (!identifier) {
      throw new EmailProviderError(
        "Subscriber identifier is required for Customer.io.",
        "REQUEST_FAILED"
      );
    }

    try {
      if (!params.active) {
        await this.request(`${this.appBase}/customers/${encodeURIComponent(identifier)}/suppress`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.appKey}`,
          },
          expectJson: false,
        });
      } else {
        await this.request(`${this.appBase}/customers/${encodeURIComponent(identifier)}/suppress`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${this.config.appKey}`,
          },
          expectJson: false,
        });
      }

      return {
        id: identifier,
        email: identifier,
        active: params.active,
      };
    } catch (error) {
      throw new EmailProviderError("Failed to update Customer.io subscriber.", "REQUEST_FAILED", { cause: error });
    }
  }

  async removeSubscriber(params: { email?: string; id?: string }): Promise<void> {
    const identifier = params.email ?? params.id;
    if (!identifier) {
      throw new EmailProviderError(
        "Subscriber identifier is required for Customer.io.",
        "REQUEST_FAILED"
      );
    }

    try {
      await this.request(`${this.trackBase}/customers/${encodeURIComponent(identifier)}`, {
        method: "DELETE",
        headers: {
          Authorization: this.trackAuthHeader,
        },
        expectJson: false,
      });
    } catch (error) {
      throw new EmailProviderError("Failed to remove Customer.io subscriber.", "REQUEST_FAILED", { cause: error });
    }
  }

  async sendPatchNote({ subject, html, to, previewText }: SendPatchNotePayload) {
    if (!to.length) {
      return { providerMessageId: undefined };
    }

    let lastResponse: any = null;

    for (const recipient of to) {
      try {
        lastResponse = await this.request(`${this.transactionalBase}/send/email`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.appKey}`,
          },
          body: JSON.stringify({
            to: recipient,
            transactional_message_id: this.config.transactionalMessageId,
            identifiers: { email: recipient },
            message_data: {
              subject,
              body: html,
              preview_text: previewText,
              from: this.getFromEmail() ?? undefined,
            },
          }),
        });
      } catch (error) {
        throw new EmailProviderError("Failed to send email with Customer.io.", "REQUEST_FAILED", { cause: error });
      }
    }

    return { providerMessageId: lastResponse?.delivery_id };
  }
}
