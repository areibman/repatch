import type {
  EmailIntegrationConfig,
  EmailProvider,
  ProviderSettingsMap,
} from "@/types/email";
import type { EmailProviderAdapter } from "./base";
import { createResendAdapter } from "./resend";
import { createCustomerIoAdapter } from "./customerio";

export const EMAIL_PROVIDER_LABELS: Record<EmailProvider, string> = {
  resend: "Resend",
  customerio: "Customer.io",
};

export function createEmailProviderAdapter(
  config: EmailIntegrationConfig
): EmailProviderAdapter {
  switch (config.provider) {
    case "resend":
      return createResendAdapter(
        config.settings as ProviderSettingsMap["resend"]
      );
    case "customerio":
      return createCustomerIoAdapter(
        config.settings as ProviderSettingsMap["customerio"]
      );
    default:
      throw new Error(`Unsupported email provider: ${config.provider}`);
  }
}
