import { APIClient, TrackClient } from "customerio-node";
import {
  EmailIntegrationConfig,
  EmailProvider,
  EmailSubscriber,
  SendEmailOptions,
  SendEmailResult,
  SubscriberIdentifier,
} from "../types";
import { EmailProviderConfigurationError } from "../errors";

interface CustomerIoProviderDependencies {
  apiClient?: APIClient;
  trackClient?: TrackClient;
}

const DEFAULT_CUSTOMER_IO_SENDER = "Repatch <updates@customeriomail.com>";

export function createCustomerIoProvider(
  config: EmailIntegrationConfig,
  deps: CustomerIoProviderDependencies = {}
): EmailProvider {
  const siteId =
    config.credentials.siteId || process.env.CUSTOMERIO_SITE_ID || "";
  const trackApiKey =
    config.credentials.trackApiKey ||
    config.credentials.apiKey ||
    process.env.CUSTOMERIO_TRACK_API_KEY ||
    process.env.CUSTOMERIO_API_KEY ||
    "";
  const appApiKey =
    config.credentials.appApiKey ||
    config.credentials.transactionalApiKey ||
    process.env.CUSTOMERIO_APP_API_KEY ||
    process.env.CUSTOMERIO_TRANSACTIONAL_API_KEY ||
    process.env.CUSTOMERIO_API_KEY ||
    "";

  if (!siteId || !trackApiKey) {
    throw new EmailProviderConfigurationError(
      "Customer.io provider requires a site ID and track API key"
    );
  }

  if (!appApiKey) {
    throw new EmailProviderConfigurationError(
      "Customer.io provider requires a transactional API key"
    );
  }

  const transactionalMessageId =
    config.credentials.transactionalMessageId ||
    process.env.CUSTOMERIO_TRANSACTIONAL_MESSAGE_ID;

  const defaultSender =
    config.defaultSender || config.credentials.fromEmail || DEFAULT_CUSTOMER_IO_SENDER;

  const apiClient = deps.apiClient ?? new APIClient(appApiKey);
  const trackClient = deps.trackClient ?? new TrackClient(siteId, trackApiKey);

  async function identifySubscriber(
    email: string,
    properties: Record<string, string | number | boolean | null> = {}
  ) {
    const identifier = properties.id ?? email;

    await trackClient.identify({
      id: identifier,
      email,
      ...properties,
    } as any);

    const subscriber: EmailSubscriber = {
      id: String(identifier),
      email,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      raw: { email, ...properties },
    };

    return subscriber;
  }

  const basicAuthHeader = `Basic ${Buffer.from(`${siteId}:${trackApiKey}`).toString(
    "base64"
  )}`;

  const provider: EmailProvider = {
    id: "customerio",
    name: "Customer.io",
    async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
      if (!options.to.length) {
        return {
          id: undefined,
          accepted: [],
          rejected: [],
          provider: "customerio",
        };
      }

      const accepted: string[] = [];
      const rejected: string[] = [];
      const metadata: Record<string, unknown> = {};

      for (const recipient of options.to) {
        try {
          const payload: Record<string, unknown> = {
            to: {
              email: recipient,
            },
            subject: options.subject,
            body: {
              plaintext: options.text ?? "",
              html: options.html,
            },
            from: options.from ?? defaultSender,
          };

          if (options.replyTo) {
            payload.reply_to = options.replyTo;
          }

          if (transactionalMessageId) {
            payload.transactional_message_id = transactionalMessageId;
          }

          const response = await apiClient.sendEmail(payload as any);
          accepted.push(recipient);
          metadata[recipient] = response;
        } catch (error) {
          rejected.push(recipient);
        }
      }

      if (!accepted.length) {
        throw new Error("Customer.io failed to send email to all recipients");
      }

      return {
        id: undefined,
        accepted,
        rejected,
        provider: "customerio",
        meta: metadata,
      };
    },
    async listSubscribers(): Promise<EmailSubscriber[]> {
      const response = await fetch(
        "https://track.customer.io/api/v1/customers?per_page=200",
        {
          headers: {
            Authorization: basicAuthHeader,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch Customer.io subscribers");
      }

      const payload = (await response.json()) as {
        customers?: Array<Record<string, any>>;
      };

      if (!payload.customers) {
        return [];
      }

      return payload.customers
        .filter((customer) => Boolean(customer.email))
        .map((customer) => ({
          id: String(customer.id ?? customer.customer_id ?? customer.email),
          email: customer.email,
          active: !customer.suppressed,
          createdAt: customer.created_at
            ? new Date(customer.created_at * 1000).toISOString()
            : undefined,
          updatedAt: customer.updated_at
            ? new Date(customer.updated_at * 1000).toISOString()
            : undefined,
          raw: customer,
        }));
    },
    async addSubscriber(
      email: string,
      properties: Record<string, string | number | boolean | null> = {}
    ): Promise<EmailSubscriber> {
      return identifySubscriber(email, properties);
    },
    async removeSubscriber(identifier: SubscriberIdentifier): Promise<void> {
      const id = identifier.id ?? identifier.email;

      if (!id) {
        throw new Error("Customer.io removal requires an id or email");
      }

      await trackClient.destroy(id);
    },
    async updateSubscriber(
      identifier: SubscriberIdentifier,
      properties: { active?: boolean } & Record<string, unknown>
    ): Promise<EmailSubscriber> {
      const email = identifier.email;

      if (!email) {
        throw new Error(
          "Customer.io update requires the subscriber email to be provided"
        );
      }

      if (properties.active === false) {
        await trackClient.suppress(identifier.id ?? email);
        return {
          id: identifier.id ?? email,
          email,
          active: false,
          updatedAt: new Date().toISOString(),
        } as EmailSubscriber;
      }

      if (properties.active === true) {
        await trackClient.unsuppress(identifier.id ?? email);
      }

      return identifySubscriber(email, properties as any);
    },
    getManageUrl() {
      return "https://fly.customer.io/login";
    },
  };

  return provider;
}
