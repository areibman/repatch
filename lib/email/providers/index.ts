import {
  EmailProvider,
  EmailProviderName,
} from "../types";
import {
  ResendEmailProvider,
  ResendProviderConfig,
} from "./resend";
import {
  CustomerioEmailProvider,
  CustomerioProviderConfig,
} from "./customerio";

export type ProviderConfig =
  | ({ provider: "resend" } & ResendProviderConfig)
  | ({ provider: "customerio" } & CustomerioProviderConfig);

export function createEmailProvider(
  provider: EmailProviderName,
  config: Record<string, unknown> = {}
): EmailProvider {
  switch (provider) {
    case "resend": {
      const typedConfig: ResendProviderConfig = {
        apiKey: typeof config.apiKey === "string" ? config.apiKey : undefined,
        fromEmail:
          typeof config.fromEmail === "string" ? config.fromEmail : undefined,
        fromName:
          typeof config.fromName === "string" ? config.fromName : undefined,
        replyTo: typeof config.replyTo === "string" ? config.replyTo : undefined,
        audienceId:
          typeof config.audienceId === "string" ? config.audienceId : undefined,
      };
      return new ResendEmailProvider(typedConfig);
    }
    case "customerio": {
      const regionValue =
        typeof config.region === "string"
          ? (config.region.toLowerCase() === "eu" ? "eu" : "us")
          : undefined;
      const typedConfig: CustomerioProviderConfig = {
        appApiKey:
          typeof config.appApiKey === "string" ? config.appApiKey : undefined,
        siteId: typeof config.siteId === "string" ? config.siteId : undefined,
        region: regionValue,
        transactionalApiKey:
          typeof config.transactionalApiKey === "string"
            ? config.transactionalApiKey
            : undefined,
        transactionalMessageId:
          typeof config.transactionalMessageId === "string"
            ? config.transactionalMessageId
            : undefined,
        fromEmail:
          typeof config.fromEmail === "string" ? config.fromEmail : undefined,
        fromName:
          typeof config.fromName === "string" ? config.fromName : undefined,
        replyTo: typeof config.replyTo === "string" ? config.replyTo : undefined,
      };
      return new CustomerioEmailProvider(typedConfig);
    }
    default:
      throw new Error(`Unsupported email provider: ${provider}`);
  }
}
