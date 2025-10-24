export type EmailProvider = "resend" | "customerio";

export interface BaseProviderSettings {
  fromEmail?: string | null;
  fromName?: string | null;
}

export interface ResendSettings extends BaseProviderSettings {
  apiKey: string | null;
  audienceId?: string | null;
  replyTo?: string | null;
}

export type CustomerIoRegion = "us" | "eu";

export interface CustomerIoSettings extends BaseProviderSettings {
  appApiKey: string | null;
  region?: CustomerIoRegion | null;
  broadcastId?: string | null; // API-triggered broadcast ID from Customer.io UI
}

export type ProviderSettingsMap = {
  resend: ResendSettings;
  customerio: CustomerIoSettings;
};

export type ProviderSettings = ProviderSettingsMap[EmailProvider];

export interface EmailIntegrationConfig {
  id?: string;
  provider: EmailProvider;
  isActive: boolean;
  settings: ProviderSettings;
  source: "database" | "environment" | "fallback";
}

export interface EmailSubscriber {
  id: string;
  email: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SendEmailOptions {
  fromName: string;
  fromEmail: string;
  to: string[]; // For Resend: list of emails. For Customer.io: can be empty if using broadcastId
  subject: string;
  html: string;
  text: string;
  broadcastId?: string; // For Customer.io: trigger an API-triggered broadcast
  broadcastData?: Record<string, any>; // Data to pass to the broadcast template
}

export interface SendEmailResult {
  id?: string;
  provider: EmailProvider;
  deliveredTo: number;
}
