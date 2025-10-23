import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type EmailProviderId = "resend" | "customerio";

export interface EmailSubscriber {
  id: string;
  email: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderMetadata {
  provider: EmailProviderId;
  isActive: boolean;
  settings: Record<string, unknown>;
}

export interface EmailProviderContext {
  supabase?: SupabaseClient<Database>;
}

export interface EmailProvider {
  id: EmailProviderId;
  displayName: string;
  listSubscribers(): Promise<EmailSubscriber[]>;
  createSubscriber(input: {
    email: string;
    firstName?: string;
    lastName?: string;
  }): Promise<EmailSubscriber>;
  updateSubscriber(input: {
    id?: string;
    email?: string;
    unsubscribed?: boolean;
  }): Promise<EmailSubscriber>;
  removeSubscriber(input: { id?: string; email?: string }): Promise<void>;
  sendCampaign(input: {
    subject: string;
    html: string;
    text?: string;
    previewText?: string;
    recipients: string[];
  }): Promise<{ sentTo: number }>;
}

export type EmailProviderFactory = (
  settings: Record<string, unknown>,
  context?: EmailProviderContext
) => EmailProvider;
