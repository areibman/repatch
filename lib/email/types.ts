import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

type EmailIntegrationRow = Database["public"]["Tables"]["email_integrations"]["Row"];

type EmailProviderEnum = EmailIntegrationRow["provider"];

export type EmailProviderName = EmailProviderEnum | "resend";

export interface EmailIntegrationSettings {
  id: string;
  provider: EmailProviderName;
  displayName: string | null;
  fromEmail: string;
  apiKey: string;
  audienceId?: string | null;
  siteId?: string | null;
  trackApiKey?: string | null;
  transactionalMessageId?: string | null;
  metadata?: Record<string, Json>;
  isActive?: boolean;
}

export interface EmailSubscriber {
  id: string;
  email: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddSubscriberPayload {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface UpdateSubscriberPayload {
  id?: string;
  email?: string;
  unsubscribed?: boolean;
}

export interface RemoveSubscriberPayload {
  id?: string;
  email?: string;
}

export interface SendPatchNoteOptions {
  subject: string;
  html: string;
  previewText?: string;
  recipients: EmailSubscriber[];
}

export interface EmailSendResult {
  totalRecipients: number;
  providerMessageIds: string[];
}

export interface EmailProviderDependencies {
  supabase?: SupabaseClient<Database>;
  fetchImpl?: typeof fetch;
}

export interface EmailProvider {
  readonly name: EmailProviderName;
  readonly config: EmailIntegrationSettings;
  listSubscribers(): Promise<EmailSubscriber[]>;
  addSubscriber(payload: AddSubscriberPayload): Promise<EmailSubscriber>;
  updateSubscriber(payload: UpdateSubscriberPayload): Promise<EmailSubscriber>;
  removeSubscriber(payload: RemoveSubscriberPayload): Promise<void>;
  sendPatchNoteEmail(options: SendPatchNoteOptions): Promise<EmailSendResult>;
}

export type EmailIntegrationInput = Partial<Omit<EmailIntegrationRow, "id" | "provider">> & {
  provider: EmailProviderName;
};
