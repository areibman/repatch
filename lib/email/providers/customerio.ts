import { randomUUID } from "crypto";
import {
  AddSubscriberPayload,
  EmailProvider,
  EmailSubscriber,
  RemoveSubscriberPayload,
  SendEmailPayload,
  SendEmailResult,
  UpdateSubscriberPayload,
} from "../types";

export type CustomerIOProviderOptions = {
  siteId: string;
  apiKey: string;
  appKey: string;
  transactionalMessageId: string;
  fromEmail: string;
  region?: "us" | "eu";
  manageUrl?: string;
  trackBaseUrl?: string;
  transactionalBaseUrl?: string;
};

type HttpClient = (url: string, init?: RequestInit) => Promise<Response>;

function toIsoTimestamp(value?: number | string | null): string {
  if (typeof value === "number") {
    const seconds = value > 10_000_000_000 ? value : value * 1000;
    return new Date(seconds).toISOString();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return new Date().toISOString();
}

export class CustomerIOEmailProvider implements EmailProvider {
  public readonly name = "customerio" as const;
  public readonly manageUrl: string;
  public readonly fromEmail: string;

  private readonly siteId: string;
  private readonly apiKey: string;
  private readonly appKey: string;
  private readonly transactionalMessageId: string;
  private readonly trackBaseUrl: string;
  private readonly transactionalBaseUrl: string;
  private readonly http: HttpClient;

  constructor(options: CustomerIOProviderOptions, httpClient?: HttpClient) {
    this.siteId = options.siteId;
    this.apiKey = options.apiKey;
    this.appKey = options.appKey;
    this.transactionalMessageId = options.transactionalMessageId;
    this.fromEmail = options.fromEmail;
    this.manageUrl =
      options.manageUrl ?? "https://fly.customer.io/";

    const suffix = options.region === "eu" ? "-eu" : "";
    this.trackBaseUrl =
      options.trackBaseUrl ?? `https://track${suffix}.customer.io/api/v1`;
    this.transactionalBaseUrl =
      options.transactionalBaseUrl ?? `https://api${suffix}.customer.io/v1`;

    this.http = httpClient ?? (globalThis.fetch.bind(globalThis) as HttpClient);
  }

  private basicHeaders(contentType = "application/json"): HeadersInit {
    const token = Buffer.from(`${this.siteId}:${this.apiKey}`).toString("base64");
    return {
      Authorization: `Basic ${token}`,
      "Content-Type": contentType,
    };
  }

  private bearerHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.appKey}`,
      "Content-Type": "application/json",
    };
  }

  private mapCustomer(customer: any): EmailSubscriber {
    const email = customer?.email ?? customer?.attributes?.email;
    const id =
      customer?.id ??
      customer?.customer_id ??
      customer?.identifier ??
      email;

    return {
      id: id ?? email ?? randomUUID(),
      email: email ?? "",
      active: !(customer?.suppressed ?? customer?.attributes?.suppressed ?? false),
      createdAt: toIsoTimestamp(customer?.created_at ?? Date.now()),
      updatedAt: toIsoTimestamp(customer?.updated_at ?? customer?.created_at ?? Date.now()),
    };
  }

  private async fetchCustomer(identifier: string): Promise<EmailSubscriber | null> {
    if (!identifier) {
      return null;
    }

    const response = await this.http(
      `${this.trackBaseUrl}/customers/${encodeURIComponent(identifier)}`,
      {
        method: "GET",
        headers: this.basicHeaders(),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const customer = data?.customer ?? data;

    if (!customer) {
      return null;
    }

    return this.mapCustomer(customer);
  }

  async listSubscribers(): Promise<EmailSubscriber[]> {
    const response = await this.http(`${this.trackBaseUrl}/customers?limit=200`, {
      method: "GET",
      headers: this.basicHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch subscribers from Customer.io");
    }

    const data = await response.json();
    const customers = Array.isArray(data?.customers)
      ? data.customers
      : Array.isArray(data?.results)
      ? data.results
      : [];

    return customers.map((customer: any) => this.mapCustomer(customer));
  }

  async addSubscriber(payload: AddSubscriberPayload): Promise<EmailSubscriber> {
    const response = await this.http(
      `${this.trackBaseUrl}/customers/${encodeURIComponent(payload.email)}`,
      {
        method: "PUT",
        headers: this.basicHeaders(),
        body: JSON.stringify({
          email: payload.email,
          first_name: payload.firstName,
          last_name: payload.lastName,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to add subscriber to Customer.io");
    }

    const subscriber =
      (await this.fetchCustomer(payload.email)) ??
      ({
        id: payload.email,
        email: payload.email,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as EmailSubscriber);

    return subscriber;
  }

  async updateSubscriber(
    payload: UpdateSubscriberPayload
  ): Promise<EmailSubscriber> {
    const identifier = payload.email ?? payload.id;

    if (!identifier) {
      throw new Error("Email or ID is required to update a subscriber");
    }

    if (typeof payload.unsubscribed === "boolean") {
      const suppressUrl = `${this.trackBaseUrl}/customers/${encodeURIComponent(
        identifier
      )}/suppress`;

      const response = await this.http(suppressUrl, {
        method: payload.unsubscribed ? "POST" : "DELETE",
        headers: this.basicHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to update subscriber status in Customer.io");
      }
    }

    const subscriber =
      (await this.fetchCustomer(identifier)) ??
      ({
        id: identifier,
        email: payload.email ?? identifier,
        active: !(payload.unsubscribed ?? false),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as EmailSubscriber);

    return subscriber;
  }

  async removeSubscriber(payload: RemoveSubscriberPayload): Promise<void> {
    const identifier = payload.email ?? payload.id;

    if (!identifier) {
      throw new Error("Email or ID is required to remove a subscriber");
    }

    const response = await this.http(
      `${this.trackBaseUrl}/customers/${encodeURIComponent(identifier)}`,
      {
        method: "DELETE",
        headers: this.basicHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to remove subscriber from Customer.io");
    }
  }

  async sendCampaign(payload: SendEmailPayload): Promise<SendEmailResult> {
    if (payload.recipients.length === 0) {
      throw new Error("At least one recipient is required to send email");
    }

    const delivered: string[] = [];

    for (const email of payload.recipients) {
      const response = await this.http(
        `${this.transactionalBaseUrl}/send/email`,
        {
          method: "POST",
          headers: this.bearerHeaders(),
          body: JSON.stringify({
            transactional_message_id: this.transactionalMessageId,
            to: { email },
            message_data: {
              from: this.fromEmail,
              subject: payload.subject,
              html: payload.html,
              text: payload.text,
              preview_text: payload.previewText,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Customer.io send failed for ${email}: ${response.status} ${errorBody}`
        );
      }

      delivered.push(email);
    }

    return {
      id: `${this.transactionalMessageId}:${Date.now()}`,
      deliveredTo: delivered,
    };
  }
}
