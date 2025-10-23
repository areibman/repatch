import {
  APIClient,
  RegionEU,
  RegionUS,
  SendEmailRequest,
  TrackClient,
} from "customerio-node";
import type {
  EmailProvider,
  EmailProviderContext,
  EmailSubscriber,
} from "../types";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type CustomerIoRegion = "us" | "eu";

type CustomerIoSettings = {
  appApiKey?: string;
  region?: CustomerIoRegion;
  transactionalMessageId?: string;
  fromEmail?: string;
  fromName?: string;
  trackSiteId?: string;
  trackApiKey?: string;
};

const REGION_BY_KEY: Record<CustomerIoRegion, typeof RegionUS> = {
  us: RegionUS,
  eu: RegionEU,
};

export class CustomerIoProvider implements EmailProvider {
  public readonly id = "customerio" as const;
  public readonly displayName = "Customer.io";

  private apiClient: APIClient;
  private trackClient: TrackClient | null;
  private settings: CustomerIoSettings;
  private supabase?: SupabaseClient<Database>;

  constructor(
    settings: CustomerIoSettings = {},
    context: EmailProviderContext = {}
  ) {
    const appApiKey =
      settings.appApiKey || process.env.CUSTOMER_IO_APP_API_KEY;

    if (!appApiKey) {
      throw new Error("Customer.io App API key is not configured.");
    }

    const region = (settings.region || process.env.CUSTOMER_IO_REGION || "us")
      .toString()
      .toLowerCase() as CustomerIoRegion;

    this.apiClient = new APIClient(appApiKey, {
      region: REGION_BY_KEY[region] || RegionUS,
    });

    const siteId = settings.trackSiteId || process.env.CUSTOMER_IO_SITE_ID;
    const trackApiKey =
      settings.trackApiKey || process.env.CUSTOMER_IO_TRACK_API_KEY;

    this.trackClient =
      siteId && trackApiKey
        ? new TrackClient(siteId, trackApiKey, {
            region: REGION_BY_KEY[region] || RegionUS,
          })
        : null;

    this.settings = settings;
    this.supabase = context.supabase;
  }

  private ensureSupabase(): SupabaseClient<Database> {
    if (!this.supabase) {
      throw new Error(
        "Supabase client is required for Customer.io subscriber operations."
      );
    }

    return this.supabase;
  }

  private get fromAddress(): string {
    const fromEmail =
      this.settings.fromEmail ||
      process.env.CUSTOMER_IO_FROM_EMAIL ||
      "patch-notes@example.com";
    const fromName =
      this.settings.fromName ||
      process.env.CUSTOMER_IO_FROM_NAME ||
      "Patch Notes";

    return `${fromName} <${fromEmail}>`;
  }

  private get transactionalMessageId(): string | null {
    return (
      this.settings.transactionalMessageId ||
      process.env.CUSTOMER_IO_TRANSACTIONAL_MESSAGE_ID ||
      null
    );
  }

  async listSubscribers(): Promise<EmailSubscriber[]> {
    const supabase = this.ensureSupabase();
    const { data, error } = await supabase
      .from("email_subscribers")
      .select("id, email, active, created_at, updated_at");

    if (error) {
      throw error;
    }

    return (
      data?.map((row) => ({
        id: row.id,
        email: row.email,
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })) ?? []
    );
  }

  async createSubscriber(input: {
    email: string;
    firstName?: string;
    lastName?: string;
  }): Promise<EmailSubscriber> {
    if (this.trackClient) {
      await this.trackClient.identify(input.email, {
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
      });
    }

    const supabase = this.ensureSupabase();
    const { data, error } = await supabase
      .from("email_subscribers")
      .upsert(
        {
          email: input.email,
          active: true,
        },
        { onConflict: "email" }
      )
      .select("id, email, active, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      email: data.email,
      active: data.active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateSubscriber(input: {
    id?: string;
    email?: string;
    unsubscribed?: boolean;
  }): Promise<EmailSubscriber> {
    const targetEmail = input.email;

    if (!targetEmail && !input.id) {
      throw new Error("Email or ID is required to update a subscriber.");
    }

    const supabase = this.ensureSupabase();
    const { data, error } = await supabase
      .from("email_subscribers")
      .update({ active: !(input.unsubscribed ?? false) })
      .eq(input.id ? "id" : "email", input.id ?? targetEmail ?? "")
      .select("id, email, active, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    if (this.trackClient && (data.email || targetEmail)) {
      // Customer.io identifies people by their email address for track API operations.
      if (input.unsubscribed) {
        await this.trackClient.suppress(data.email);
      } else {
        await this.trackClient.unsuppress(data.email);
      }
    }

    return {
      id: data.id,
      email: data.email,
      active: data.active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async removeSubscriber(input: {
    id?: string;
    email?: string;
  }): Promise<void> {
    if (!input.id && !input.email) {
      throw new Error("Email or ID is required to remove a subscriber.");
    }

    const supabase = this.ensureSupabase();
    const targetColumn = input.id ? "id" : "email";
    const targetValue = input.id ?? input.email ?? "";

    const { data: subscriber, error: fetchError } = await supabase
      .from("email_subscribers")
      .select("id, email")
      .eq(targetColumn, targetValue)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!subscriber) {
      return;
    }

    await supabase.from("email_subscribers").delete().eq(targetColumn, targetValue);

    if (this.trackClient && subscriber.email) {
      // Destroy the profile using the email identifier to keep Track API state in sync.
      await this.trackClient.destroy(subscriber.email);
    }
  }

  async sendCampaign(input: {
    subject: string;
    html: string;
    text?: string;
    previewText?: string;
    recipients: string[];
  }): Promise<{ sentTo: number }> {
    if (!input.recipients.length) {
      return { sentTo: 0 };
    }

    const transactionalMessageId = this.transactionalMessageId;

    const requests = input.recipients.map((email) => {
      const request = new SendEmailRequest({
        to: email,
        identifiers: { email },
        message_data: {
          preview_text: input.previewText,
        },
        ...(transactionalMessageId
          ? { transactional_message_id: transactionalMessageId }
          : {
              subject: input.subject,
              from: this.fromAddress,
              body: input.html,
              body_plain: input.text,
            }),
      });

      return this.apiClient.sendEmail(request);
    });

    await Promise.all(requests);

    return { sentTo: input.recipients.length };
  }
}

export type { CustomerIoSettings };
