import type {
  CustomerIoRegion,
  CustomerIoSettings,
  EmailSubscriber,
  SendEmailOptions,
  SendEmailResult,
} from "@/types/email";
import type { EmailProviderAdapter } from "./base";

function resolveRegion(settings: CustomerIoSettings): CustomerIoRegion {
  const region = settings.region ?? (process.env.CUSTOMERIO_REGION as CustomerIoRegion | undefined);
  return region === "eu" ? "eu" : "us";
}

function resolveBaseUrl(region: CustomerIoRegion) {
  return region === "eu" ? "https://api-eu.customer.io" : "https://api.customer.io";
}

function htmlToPlaintext(html: string) {
  return html
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createCustomerIoAdapter(settings: CustomerIoSettings): EmailProviderAdapter {
  const apiKey = settings.appApiKey ?? process.env.CUSTOMERIO_APP_API_KEY;

  if (!apiKey) {
    throw new Error("Customer.io App API key is not configured");
  }

  const region = resolveRegion(settings);
  const baseUrl = resolveBaseUrl(region);
  const fromEmail =
    settings.fromEmail ??
    process.env.CUSTOMERIO_FROM_EMAIL ??
    process.env.RESEND_FROM_EMAIL ??
    "updates@customer.io";
  const fromName = settings.fromName ?? process.env.CUSTOMERIO_FROM_NAME ?? "Repatch";

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Customer.io request failed: ${response.status} ${message}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    return null;
  }

  function resolveCustomerKey(id?: string, email?: string) {
    if (id) {
      return id;
    }
    if (!email) {
      throw new Error("Email address is required when id is not provided");
    }
    return email;
  }

  function normalizeSubscriber(customer: any): EmailSubscriber {
    const attributes = customer.attributes ?? {};
    const email = customer.email ?? attributes.email;
    return {
      id: String(customer.id ?? email),
      email,
      active: !customer.suppressed,
      createdAt: customer.created_at ?? undefined,
      updatedAt: customer.updated_at ?? undefined,
    };
  }

  return {
    id: "customerio",
    label: "Customer.io",
    managementUrl: region === "eu" ? "https://app-eu.customer.io" : "https://app.customer.io",
    async listSubscribers() {
      const data = await request("/v1/api/customers?limit=500", {
        method: "GET",
      });

      const customers = (data?.customers ?? []) as any[];
      return customers
        .filter((customer) => (customer.email ?? customer.attributes?.email) != null)
        .map(normalizeSubscriber);
    },
    async createSubscriber({ email, firstName = "", lastName = "" }) {
      const body = {
        email,
        attributes: {
          email,
          first_name: firstName,
          last_name: lastName,
        },
      };

      await request(`/v1/api/customers/${encodeURIComponent(email)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      return {
        id: email,
        email,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
    async updateSubscriber({ id, email, active }) {
      const customerKey = resolveCustomerKey(id, email);

      await request(
        `/v1/api/customers/${encodeURIComponent(customerKey)}/${active ? "unsuppress" : "suppress"}`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      return {
        id: customerKey,
        email: email ?? customerKey,
        active,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
    async deleteSubscriber({ id, email }) {
      const customerKey = resolveCustomerKey(id, email);
      await request(`/v1/api/customers/${encodeURIComponent(customerKey)}`, {
        method: "DELETE",
      });
    },
    async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
      const payload = {
        to: options.to.map((email) => ({ email })),
        message: {
          subject: options.subject,
          from: {
            email: fromEmail,
            name: fromName,
          },
          body: {
            html: options.html,
            plaintext: options.text || htmlToPlaintext(options.html),
          },
        },
      };

      const response = await request("/v1/send/email", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return {
        id: response?.delivery_id ?? response?.id ?? undefined,
        provider: "customerio",
        deliveredTo: options.to.length,
      };
    },
  };
}
