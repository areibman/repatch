import type { EmailProvider, EmailSubscriber, SendEmailOptions, SendEmailResult } from "@/types/email";

export interface EmailProviderAdapter {
  id: EmailProvider;
  label: string;
  managementUrl?: string;
  listSubscribers(): Promise<EmailSubscriber[]>;
  createSubscriber(input: {
    email: string;
    firstName?: string;
    lastName?: string;
  }): Promise<EmailSubscriber>;
  updateSubscriber(input: {
    id?: string;
    email?: string;
    active: boolean;
  }): Promise<EmailSubscriber>;
  deleteSubscriber(input: { id?: string; email?: string }): Promise<void>;
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
}
