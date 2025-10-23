import {
  APIClient,
  RegionEU,
  RegionUS,
  SendEmailRequest,
  TrackClient,
} from "customerio-node";
import type {
  AddSubscriberPayload,
  EmailProvider,
  EmailProviderDependencies,
  EmailProviderName,
  EmailSendResult,
  EmailSubscriber,
  RemoveSubscriberPayload,
  SendPatchNoteOptions,
  UpdateSubscriberPayload,
  EmailIntegrationSettings,
} from "@/lib/email/types";
import type { Database } from "@/lib/supabase/database.types";

const REGION_FALLBACK = "us";

function resolveRegion(region?: string) {
  if (!region) return RegionUS;
  const normalized = region.toLowerCase();
  if (normalized === "eu") return RegionEU;
  return RegionUS;
}

function mapRowToSubscriber(row: Database["public"]["Tables"]["email_subscribers"]["Row"]): EmailSubscriber {
  return {
    id: row.id,
    email: row.email,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CustomerIoEmailProvider implements EmailProvider {
  readonly name: EmailProviderName = "customer_io";
  readonly config: EmailIntegrationSettings;
  private readonly apiClient: APIClient;
  private readonly trackClient?: TrackClient;
  private readonly supabase?: EmailProviderDependencies["supabase"];

  constructor(
    config: EmailIntegrationSettings,
    deps: EmailProviderDependencies = {}
  ) {
    if (!config.apiKey) {
      throw new Error("Missing Customer.io App API key");
    }

    if (!config.fromEmail) {
      throw new Error("Customer.io requires a from email address");
    }

    const region = String(
      config.metadata?.region ?? process.env.CUSTOMER_IO_REGION ?? REGION_FALLBACK
    );

    this.config = {
      ...config,
      fromEmail: config.fromEmail,
    };

    this.apiClient = new APIClient(config.apiKey, { region: resolveRegion(region) });

    if (config.siteId && config.trackApiKey) {
      this.trackClient = new TrackClient(config.siteId, config.trackApiKey, {
        region: resolveRegion(region),
      });
    }

    this.supabase = deps.supabase;
  }

  private requireSupabase() {
    if (!this.supabase) {
      throw new Error("Supabase client is required for Customer.io subscriber operations");
    }

    return this.supabase;
  }

  async listSubscribers(): Promise<EmailSubscriber[]> {
    const supabase = this.requireSupabase();
    const { data, error } = await supabase
      .from("email_subscribers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message || "Failed to load subscribers");
    }

    return (data ?? []).map(mapRowToSubscriber);
  }

  async addSubscriber(payload: AddSubscriberPayload): Promise<EmailSubscriber> {
    const supabase = this.requireSupabase();
    const { data, error } = await supabase
      .from("email_subscribers")
      .upsert({
        email: payload.email,
        active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "email" })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Failed to save subscriber");
    }

    if (this.trackClient) {
      try {
        await this.trackClient.identify(payload.email, {
          email: payload.email,
          created_at: Math.floor(Date.now() / 1000),
          first_name: payload.firstName,
          last_name: payload.lastName,
        });
      } catch (err) {
        console.warn("Customer.io identify failed", err);
      }
    }

    return mapRowToSubscriber(data);
  }

  async updateSubscriber(
    payload: UpdateSubscriberPayload
  ): Promise<EmailSubscriber> {
    const supabase = this.requireSupabase();

    const column = payload.id ? "id" : "email";
    const value = payload.id ?? payload.email;

    if (!value) {
      throw new Error("Customer.io update requires an id or email");
    }

    const updates: Partial<Database["public"]["Tables"]["email_subscribers"]["Row"]> = {};

    if (payload.unsubscribed !== undefined) {
      updates.active = !payload.unsubscribed;
    }

    const { data, error } = await supabase
      .from("email_subscribers")
      .update(updates)
      .eq(column, value)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Failed to update subscriber");
    }

    if (this.trackClient && payload.unsubscribed !== undefined) {
      try {
        if (payload.unsubscribed) {
          await this.trackClient.suppress(value);
        } else {
          await this.trackClient.unsuppress(value);
        }
      } catch (err) {
        console.warn("Customer.io suppression toggle failed", err);
      }
    }

    return mapRowToSubscriber(data);
  }

  async removeSubscriber(payload: RemoveSubscriberPayload): Promise<void> {
    const supabase = this.requireSupabase();
    const column = payload.id ? "id" : "email";
    const value = payload.id ?? payload.email;

    if (!value) {
      throw new Error("Customer.io removal requires an id or email");
    }

    const { error } = await supabase
      .from("email_subscribers")
      .delete()
      .eq(column, value);

    if (error) {
      throw new Error(error.message || "Failed to remove subscriber");
    }

    if (this.trackClient) {
      try {
        await this.trackClient.destroy(value);
      } catch (err) {
        console.warn("Customer.io destroy failed", err);
      }
    }
  }

  async sendPatchNoteEmail(
    options: SendPatchNoteOptions
  ): Promise<EmailSendResult> {
    if (!options.recipients.length) {
      throw new Error("No recipients provided");
    }

    const [primary, ...bcc] = options.recipients.map((recipient) => recipient.email);
    const identifiers = { email: primary };
    const hasTemplate = Boolean(this.config.transactionalMessageId);

    const requestOptions = hasTemplate
      ? {
          transactional_message_id: this.config.transactionalMessageId!,
          to: primary,
          identifiers,
          preheader: options.previewText,
          bcc: bcc.length ? bcc.join(",") : undefined,
          message_data: {
            subject: options.subject,
            html: options.html,
            preview_text: options.previewText ?? "",
          },
        }
      : {
          to: primary,
          identifiers,
          from: this.config.fromEmail,
          subject: options.subject,
          body: options.html,
          bcc: bcc.length ? bcc.join(",") : undefined,
          body_plain: options.previewText,
          preheader: options.previewText,
        };

    const request = new SendEmailRequest(requestOptions as any);
    const response = await this.apiClient.sendEmail(request);

    const messageId =
      response?.delivery_id || response?.message_id || response?.id || null;

    return {
      totalRecipients: options.recipients.length,
      providerMessageIds: messageId ? [String(messageId)] : [],
    };
  }
}

export function createCustomerIoProvider(
  config: EmailIntegrationSettings,
  deps?: EmailProviderDependencies
): CustomerIoEmailProvider {
  return new CustomerIoEmailProvider(config, deps);
}
