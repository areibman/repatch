export type EmailProviderName = "resend" | "customerio";

export type EmailIntegrationRecord = {
  id?: string;
  provider: EmailProviderName;
  fromEmail: string;
  credentials: Record<string, unknown>;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  isFallback?: boolean;
};

export type EmailSubscriber = {
  id: string;
  email: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AddSubscriberPayload = {
  email: string;
  firstName?: string;
  lastName?: string;
};

export type UpdateSubscriberPayload = {
  id?: string;
  email?: string;
  unsubscribed?: boolean;
};

export type RemoveSubscriberPayload = {
  id?: string;
  email?: string;
};

export type SendEmailPayload = {
  subject: string;
  html: string;
  text?: string;
  recipients: string[];
  previewText?: string;
};

export type SendEmailResult = {
  id: string;
  deliveredTo: string[];
};

export interface EmailProvider {
  readonly name: EmailProviderName;
  readonly fromEmail: string;
  readonly manageUrl: string;
  listSubscribers(): Promise<EmailSubscriber[]>;
  addSubscriber(payload: AddSubscriberPayload): Promise<EmailSubscriber>;
  updateSubscriber(payload: UpdateSubscriberPayload): Promise<EmailSubscriber>;
  removeSubscriber(payload: RemoveSubscriberPayload): Promise<void>;
  sendCampaign(payload: SendEmailPayload): Promise<SendEmailResult>;
}

export type SanitizedEmailIntegration = {
  provider: EmailProviderName;
  fromEmail: string;
  isActive: boolean;
  updatedAt?: string;
  manageUrl: string;
  isFallback?: boolean;
};
