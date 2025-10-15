import { Resend } from "resend";
import { useIntegrationMocks } from "@/lib/integration-mode";
import { createMockResendClient, type MockResendClient } from "@/lib/mocks/resend";

type ResendClient = Pick<Resend, "contacts" | "emails"> | MockResendClient;

let cachedClient: ResendClient | null = null;

export function getResendClient(): ResendClient {
  if (cachedClient) {
    return cachedClient;
  }

  if (useIntegrationMocks()) {
    cachedClient = createMockResendClient();
    return cachedClient;
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required when integrations run in live mode");
  }

  cachedClient = new Resend(process.env.RESEND_API_KEY);
  return cachedClient;
}

export function resetResendClient() {
  cachedClient = null;
}
