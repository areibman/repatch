import { EmailProviderId } from "./types";

type ProviderMetadata = {
  label: string;
  dashboardUrl: string;
  supportsAudienceManagement: boolean;
  defaultFromEmail?: string;
  secretKeys: string[];
  safeConfigKeys: string[];
};

export const EMAIL_PROVIDER_METADATA: Record<EmailProviderId, ProviderMetadata> = {
  resend: {
    label: "Resend",
    dashboardUrl: "https://resend.com",
    supportsAudienceManagement: true,
    defaultFromEmail: "Repatch <onboarding@resend.dev>",
    secretKeys: ["apiKey"],
    safeConfigKeys: ["audienceId"],
  },
  customerio: {
    label: "Customer.io",
    dashboardUrl: "https://fly.customer.io",
    supportsAudienceManagement: true,
    defaultFromEmail: undefined,
    secretKeys: ["apiKey", "appKey"],
    safeConfigKeys: ["siteId", "transactionalMessageId", "region"],
  },
};

export function getProviderMetadata(provider: EmailProviderId) {
  return EMAIL_PROVIDER_METADATA[provider];
}
