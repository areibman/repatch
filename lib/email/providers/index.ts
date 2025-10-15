import { createCustomerIoProvider } from "./customerio";
import { createResendProvider } from "./resend";
import { EmailIntegrationConfig, EmailProvider } from "../types";

export function createEmailProvider(
  config: EmailIntegrationConfig
): EmailProvider {
  switch (config.id) {
    case "resend":
      return createResendProvider(config);
    case "customerio":
      return createCustomerIoProvider(config);
    default:
      throw new Error(`Unsupported email provider: ${config.id}`);
  }
}
