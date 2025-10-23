import {
  APIClient,
  RegionEU,
  RegionUS,
  SendEmailRequest,
  TrackClient,
} from "customerio-node";

import type {
  CustomerIoProviderConfig,
  EmailIntegrationRow,
  EmailProvider,
  EmailSendRequest,
  EmailSendResult,
  EmailSubscriber,
  EmailSubscriberRow,
  SubscriberInput,
  SubscriberLookupInput,
  SubscriberUpdateInput,
  TypedSupabaseClient,
} from "@/lib/email/types";

const REGION_MAP = {
  us: RegionUS,
  eu: RegionEU,
} as const;

function mapRow(row: EmailSubscriberRow): EmailSubscriber {
  return {
    id: row.id,
    email: row.email,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: null,
  };
}

async function loadSubscriber(
  supabase: TypedSupabaseClient,
  lookup: SubscriberLookupInput
): Promise<EmailSubscriberRow> {
  if (!lookup.id && !lookup.email) {
    throw new Error("Email or ID parameter is required");
  }

  const query = supabase
    .from("email_subscribers")
    .select("*")
    .limit(1);

  const request = lookup.id
    ? query.eq("id", lookup.id)
    : query.eq("email", lookup.email!);

  const { data, error } = await request.single();

  if (error || !data) {
    throw new Error("Subscriber not found");
  }

  return data;
}

function ensureTrackClient(
  config: CustomerIoProviderConfig,
  integration?: EmailIntegrationRow
) {
  if (!config.siteId || !config.trackApiKey) {
    const source = integration ? "database" : "environment";
    throw new Error(
      `Customer.io Track API credentials are missing from ${source}. Provide both site ID and track API key.`
    );
  }

  const region = REGION_MAP[config.region] ?? RegionUS;
  return new TrackClient(config.siteId, config.trackApiKey, { region });
}

export function createCustomerIoProvider(
  config: CustomerIoProviderConfig,
  supabase: TypedSupabaseClient,
  integration?: EmailIntegrationRow
): EmailProvider {
  const region = REGION_MAP[config.region] ?? RegionUS;
  const apiClient = new APIClient(config.appKey, { region });

  const getTrackClient = () => ensureTrackClient(config, integration);

  return {
    id: "customerio",
    displayName: "Customer.io",

    async listSubscribers(): Promise<EmailSubscriber[]> {
      const { data, error } = await supabase
        .from("email_subscribers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(
          error.message || "Failed to load Customer.io subscribers"
        );
      }

      return (data ?? []).map(mapRow);
    },

    async addSubscriber(input: SubscriberInput): Promise<EmailSubscriber> {
      const { data, error } = await supabase
        .from("email_subscribers")
        .upsert(
          {
            email: input.email,
            active: true,
          },
          { onConflict: "email" }
        )
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Failed to store subscriber");
      }

      try {
        const trackClient = getTrackClient();
        await trackClient.identify(data.id, {
          email: input.email,
          first_name: input.firstName,
          last_name: input.lastName,
        });
        await trackClient.unsuppress(data.id).catch(() => undefined);
      } catch (trackError) {
        throw new Error(
          trackError instanceof Error
            ? trackError.message
            : "Failed to sync subscriber with Customer.io"
        );
      }

      return mapRow(data);
    },

    async removeSubscriber(input: SubscriberLookupInput): Promise<void> {
      const subscriber = await loadSubscriber(supabase, input);

      const { error } = await supabase
        .from("email_subscribers")
        .delete()
        .eq("id", subscriber.id);

      if (error) {
        throw new Error(error.message || "Failed to delete subscriber");
      }

      try {
        const trackClient = getTrackClient();
        await trackClient.destroy(subscriber.id);
      } catch (trackError) {
        throw new Error(
          trackError instanceof Error
            ? trackError.message
            : "Failed to remove subscriber from Customer.io"
        );
      }
    },

    async updateSubscriber(
      input: SubscriberUpdateInput
    ): Promise<EmailSubscriber> {
      const subscriber = await loadSubscriber(supabase, input);

      const { data, error } = await supabase
        .from("email_subscribers")
        .update({ active: !input.unsubscribed })
        .eq("id", subscriber.id)
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Failed to update subscriber");
      }

      try {
        const trackClient = getTrackClient();

        if (input.unsubscribed) {
          await trackClient.suppress(subscriber.id);
        } else {
          await trackClient.unsuppress(subscriber.id);
          await trackClient.identify(subscriber.id, { email: subscriber.email });
        }
      } catch (trackError) {
        throw new Error(
          trackError instanceof Error
            ? trackError.message
            : "Failed to update Customer.io subscriber"
        );
      }

      return mapRow(data);
    },

    async sendCampaign(payload: EmailSendRequest): Promise<EmailSendResult> {
      const failed: EmailSendResult["failed"] = [];
      let sent = 0;

      for (const recipient of payload.to) {
        const request = new SendEmailRequest({
          to: recipient,
          from: config.fromEmail,
          subject: payload.subject,
          body: payload.html,
          identifiers: { email: recipient },
          ...(payload.text ? { body_plain: payload.text } : {}),
        });

        try {
          await apiClient.sendEmail(request);
          sent += 1;
        } catch (error) {
          failed.push({
            email: recipient,
            message:
              error instanceof Error
                ? error.message
                : "Failed to send via Customer.io",
          });
        }
      }

      if (failed.length && sent === 0) {
        throw new Error(failed[0]?.message ?? "Failed to send email");
      }

      return { sent, failed, metadata: { provider: "customerio" } };
    },
  };
}
