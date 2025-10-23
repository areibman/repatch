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
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  id?: string;
  provider: EmailProvider;
  deliveredTo: number;
}
