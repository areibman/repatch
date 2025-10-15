export type IntegrationMode = "mock" | "live";

function normalize(value: string | undefined): IntegrationMode | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "mock") return "mock";
  if (normalized === "live") return "live";
  return undefined;
}

export function getIntegrationMode(): IntegrationMode {
  const explicit = normalize(process.env.INTEGRATION_MODE);
  if (explicit) {
    return explicit;
  }

  if (process.env.PLAYWRIGHT_LIVE === "1") {
    return "live";
  }

  if (process.env.CI || process.env.NODE_ENV === "test") {
    return "mock";
  }

  return "live";
}

export function useIntegrationMocks(): boolean {
  return getIntegrationMode() === "mock";
}
