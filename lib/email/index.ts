import { createEmailProvider } from "./providers";
import { EmailProviderConfigurationError } from "./errors";
import { EmailProvider } from "./types";
import { getActiveEmailIntegration } from "./integrations";

export * from "./types";
export * from "./errors";
export * from "./integrations";
export * from "./providers";

export async function resolveEmailProvider(): Promise<EmailProvider> {
  const config = await getActiveEmailIntegration();

  if (!config) {
    throw new EmailProviderConfigurationError(
      "No email provider is configured. Add credentials in the integrations dashboard."
    );
  }

  return createEmailProvider(config);
}
