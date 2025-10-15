"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export type ApiKeySummary = {
  id: string;
  name: string;
  description: string | null;
  tokenPreview: string;
  status: "active" | "revoked" | "expired";
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
};

type ApiKeyResponse = {
  key: ApiKeySummary;
  token?: string;
};

type Props = {
  initialKeys: ApiKeySummary[];
};

type PendingToken = {
  token: string;
  label: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusVariant(status: ApiKeySummary["status"]) {
  switch (status) {
    case "active":
      return "default" as const;
    case "expired":
      return "secondary" as const;
    case "revoked":
    default:
      return "destructive" as const;
  }
}

export function ApiKeyManager({ initialKeys }: Props) {
  const [keys, setKeys] = useState<ApiKeySummary[]>(initialKeys);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingToken, setPendingToken] = useState<PendingToken | null>(null);

  const activeKeys = useMemo(
    () => keys.filter((key) => key.status === "active"),
    [keys]
  );

  async function handleCreateKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        name,
        description,
      };

      if (expiresAt) {
        const isoString = new Date(expiresAt).toISOString();
        payload.expiresAt = isoString;
      }

      const response = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create API key");
      }

      const data: ApiKeyResponse = await response.json();
      setKeys((current) => [data.key, ...current]);
      if (data.token) {
        setPendingToken({ token: data.token, label: "New API key" });
      }
      setName("");
      setDescription("");
      setExpiresAt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRotateKey(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/admin/api-keys/${id}/rotate`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to rotate API key");
      }
      const data: ApiKeyResponse = await response.json();
      setKeys((current) =>
        current.map((key) => (key.id === id ? data.key : key))
      );
      if (data.token) {
        setPendingToken({ token: data.token, label: "Rotated API key" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rotate API key");
    }
  }

  async function handleRevokeKey(id: string) {
    if (!window.confirm("Revoke this API key? This action cannot be undone.")) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/admin/api-keys/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to revoke API key");
      }
      const data: ApiKeyResponse = await response.json();
      setKeys((current) =>
        current.map((key) => (key.id === id ? data.key : key))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key");
    }
  }

  async function handleCopyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to copy token to clipboard"
      );
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">External API keys</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Generate and manage API keys for third-party integrations. Keys are
          shown once at creation or rotation. Store them securely.
        </p>
      </section>

      {pendingToken && (
        <Card className="border-dashed border-primary">
          <CardHeader>
            <CardTitle>{pendingToken.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-2">
              Copy this token now. It will not be shown again.
            </p>
            <div className="rounded-md bg-muted p-3 font-mono text-sm break-all">
              {pendingToken.token}
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                onClick={() => handleCopyToken(pendingToken.token)}
              >
                Copy token
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPendingToken(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create a new API key</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleCreateKey}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="api-key-name">
                Name
              </label>
              <Input
                id="api-key-name"
                placeholder="Public changelog feed"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="api-key-description">
                Description (optional)
              </label>
              <Textarea
                id="api-key-description"
                placeholder="Used by the marketing site to display latest patch notes"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="api-key-expiration">
                Expiration (optional)
              </label>
              <Input
                id="api-key-expiration"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create API key"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Existing keys</h2>
          <p className="text-sm text-muted-foreground">
            Active keys: {activeKeys.length} / {keys.length}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {keys.map((key) => (
            <Card key={key.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base font-semibold">
                    {key.name}
                  </CardTitle>
                  <Badge variant={getStatusVariant(key.status)}>{key.status}</Badge>
                </div>
                <p className="text-muted-foreground text-sm mt-2">
                  {key.description ?? "No description"}
                </p>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Preview</p>
                  <p className="font-mono text-xs">{key.tokenPreview}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p>{formatDate(key.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last used</p>
                  <p>{formatDate(key.lastUsedAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Expires</p>
                  <p>{formatDate(key.expiresAt)}</p>
                </div>
              </CardContent>
              <div className="flex gap-2 p-4 pt-0">
                <Button
                  className="flex-1"
                  variant="secondary"
                  onClick={() => handleRotateKey(key.id)}
                  disabled={key.status === "revoked"}
                >
                  Rotate
                </Button>
                <Button
                  className="flex-1"
                  variant="destructive"
                  onClick={() => handleRevokeKey(key.id)}
                  disabled={key.status === "revoked"}
                >
                  Revoke
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
