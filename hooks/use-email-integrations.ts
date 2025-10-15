"use client";

import { useCallback, useEffect, useState } from "react";

export type EmailIntegrationSummary = {
  id: "resend" | "customerio";
  name: string;
  isActive: boolean;
  defaultSender?: string;
  hasCredentials: boolean;
  source: "supabase" | "env";
  manageUrl?: string | null;
  audienceId?: string;
};

export function useEmailIntegrations() {
  const [providers, setProviders] = useState<EmailIntegrationSummary[]>([]);
  const [activeProvider, setActiveProvider] = useState<
    EmailIntegrationSummary["id"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/email-integrations");

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to load email integrations");
      }

      const payload = await response.json();
      setProviders(payload.providers ?? []);
      setActiveProvider(payload.activeProvider ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    providers,
    activeProvider,
    loading,
    error,
    refresh: load,
  };
}
