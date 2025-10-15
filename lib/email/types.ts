export type EmailProviderId = "resend" | "customerio";

export type EmailIntegrationSource = "database" | "environment";

export interface EmailIntegrationConfig {
  id?: string;
  provider: EmailProviderId;
  fromEmail?: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  source: EmailIntegrationSource;
  configured: boolean;
}

export interface SanitizedIntegrationConfig {
  provider: EmailProviderId;
  label: string;
  isActive: boolean;
  configured: boolean;
  fromEmail?: string | null;
  config: Record<string, unknown>;
  source: EmailIntegrationSource;
  dashboardUrl: string;
  supportsAudienceManagement: boolean;
}

export interface EmailSubscriber {
  id: string;
  email: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SendPatchNotePayload {
  subject: string;
  html: string;
  to: string[];
  previewText?: string;
}

export interface EmailProvider {
  id: EmailProviderId;
  label: string;
  supportsAudienceManagement: boolean;
  dashboardUrl: string;
  listSubscribers(): Promise<EmailSubscriber[]>;
  addSubscriber(email: string, meta?: { firstName?: string; lastName?: string }): Promise<EmailSubscriber>;
  updateSubscriber(params: { email?: string; id?: string; active: boolean }): Promise<EmailSubscriber>;
  removeSubscriber(params: { email?: string; id?: string }): Promise<void>;
  sendPatchNote(payload: SendPatchNotePayload): Promise<{ providerMessageId?: string }>;
  getFromEmail(): string | null;
  getMetadata(): Record<string, unknown>;
}
