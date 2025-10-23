import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/supabase/database.types";

export type EmailProviderId = "resend" | "customerio";

export interface ResendProviderConfig {
  apiKey: string;
  audienceId: string;
  fromEmail: string;
}

export interface CustomerIoProviderConfig {
  appKey: string;
  fromEmail: string;
  region: "us" | "eu";
  siteId?: string | null;
  trackApiKey?: string | null;
}

export type ProviderRuntimeConfig = {
  resend?: ResendProviderConfig;
  customerio?: CustomerIoProviderConfig;
};

export interface EmailSubscriber {
  id: string;
  email: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Json | null;
}

export interface EmailSendRequest {
  subject: string;
  html: string;
  to: string[];
  from: string;
  text?: string;
}

export interface EmailSendResult {
  sent: number;
  failed: Array<{ email: string; message: string }>;
  metadata?: Record<string, unknown>;
}

export interface SubscriberInput {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface SubscriberUpdateInput {
  id?: string;
  email?: string;
  unsubscribed: boolean;
}

export interface SubscriberLookupInput {
  id?: string;
  email?: string;
}

export interface EmailProvider {
  id: EmailProviderId;
  displayName: string;
  listSubscribers(): Promise<EmailSubscriber[]>;
  addSubscriber(input: SubscriberInput): Promise<EmailSubscriber>;
  removeSubscriber(input: SubscriberLookupInput): Promise<void>;
  updateSubscriber(input: SubscriberUpdateInput): Promise<EmailSubscriber>;
  sendCampaign(payload: EmailSendRequest): Promise<EmailSendResult>;
}

export type EmailIntegrationRow =
  Database["public"]["Tables"]["email_integrations"]["Row"];
export type EmailSubscriberRow =
  Database["public"]["Tables"]["email_subscribers"]["Row"];

export type TypedSupabaseClient = SupabaseClient<Database>;
