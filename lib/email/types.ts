export type EmailProviderId = "resend" | "customerio";

export type EmailIntegrationSource = "supabase" | "env";

export type SubscriberIdentifier = {
  id?: string;
  email?: string;
};

export interface EmailIntegrationConfig {
  id: EmailProviderId;
  credentials: Record<string, string>;
  defaultSender?: string;
  audienceId?: string;
  source: EmailIntegrationSource;
}

export interface EmailIntegrationSummary {
  id: EmailProviderId;
  name: string;
  isActive: boolean;
  defaultSender?: string;
  hasCredentials: boolean;
  source: EmailIntegrationSource;
  manageUrl?: string | null;
  audienceId?: string;
}

export interface EmailSubscriber {
  id: string;
  email: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  raw?: unknown;
}

export interface SendEmailOptions {
  subject: string;
  html: string;
  text?: string;
  to: string[];
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  id?: string;
  accepted: string[];
  rejected: string[];
  provider: EmailProviderId;
  meta?: Record<string, unknown>;
}

export interface EmailProvider {
  id: EmailProviderId;
  name: string;
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
  listSubscribers(): Promise<EmailSubscriber[]>;
  addSubscriber(
    email: string,
    properties?: Record<string, string | number | boolean | null>
  ): Promise<EmailSubscriber>;
  removeSubscriber(identifier: SubscriberIdentifier): Promise<void>;
  updateSubscriber(
    identifier: SubscriberIdentifier,
    properties: { active?: boolean } & Record<string, unknown>
  ): Promise<EmailSubscriber>;
  getManageUrl?(): string | null;
}
