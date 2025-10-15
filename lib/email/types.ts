export type EmailProviderName = "resend" | "customerio";

export interface EmailSubscriber {
  id?: string;
  email: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmailSubscriberInput {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface EmailSubscriberUpdate {
  email: string;
  active?: boolean;
}

export interface EmailSendRequest {
  subject: string;
  html: string;
  text?: string;
  to: string[];
  from: {
    email: string;
    name?: string;
  };
  replyTo?: string;
  previewText?: string;
}

export interface EmailProviderCapabilities {
  canListSubscribers: boolean;
  canManageSubscribers: boolean;
}

export interface EmailSendResult {
  id?: string;
  provider: EmailProviderName;
  metadata?: Record<string, unknown>;
}

export interface EmailProvider {
  readonly id: EmailProviderName;
  readonly label: string;
  readonly capabilities: EmailProviderCapabilities;
  getFromAddress(): { email: string; name?: string } | null;
  sendEmail(payload: EmailSendRequest): Promise<EmailSendResult>;
  listSubscribers?(): Promise<EmailSubscriber[]>;
  createSubscriber?(subscriber: EmailSubscriberInput): Promise<void>;
  updateSubscriber?(update: EmailSubscriberUpdate): Promise<void>;
  deleteSubscriber?(email: string): Promise<void>;
}

export interface EmailIntegrationRecord {
  id: string;
  provider: EmailProviderName;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailProviderSummary {
  id: EmailProviderName;
  label: string;
  isActive: boolean;
  fromEmail?: string | null;
  capabilities: EmailProviderCapabilities;
  hasApiKey?: boolean;
  updatedAt?: string;
  additional?: Record<string, unknown>;
  source?: "database" | "environment";
}
