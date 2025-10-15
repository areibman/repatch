import { Resend } from "resend";
import { createMockResend, getResendSnapshot, resetMockResend } from "./mock";

type ResendClient = ReturnType<typeof createMockResend> | Resend;

const globalClient = globalThis as {
  __resendClient?: ResendClient;
};

function ensureClient(): ResendClient {
  if (process.env.RESEND_API_MODE === "mock") {
    if (!globalClient.__resendClient) {
      globalClient.__resendClient = createMockResend();
    }
    return globalClient.__resendClient;
  }

  if (!globalClient.__resendClient) {
    globalClient.__resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return globalClient.__resendClient;
}

export function getResendClient(): ResendClient {
  return ensureClient();
}

export { resetMockResend, getResendSnapshot };
