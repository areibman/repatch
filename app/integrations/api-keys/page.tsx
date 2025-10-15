"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface ApiKey {
  id: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  lastFour: string;
  rateLimitPerMinute: number;
  metadata: Record<string, unknown> | null;
  status: "active" | "revoked";
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  rotatedAt: string | null;
}

interface SecretState {
  label: string;
  secret: string;
  key: ApiKey;
}

const DEFAULT_RATE_LIMIT = 60;

const RELATIVE_TIME_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 1000 * 60 * 60 * 24 * 365],
  ["month", 1000 * 60 * 60 * 24 * 30],
  ["week", 1000 * 60 * 60 * 24 * 7],
  ["day", 1000 * 60 * 60 * 24],
  ["hour", 1000 * 60 * 60],
  ["minute", 1000 * 60],
  ["second", 1000],
];

function formatRelativeTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diff = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, ms] of RELATIVE_TIME_UNITS) {
    if (Math.abs(diff) >= ms || unit === "second") {
      const delta = Math.round(diff / ms);
      return formatter.format(delta, unit);
    }
  }

  return null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: "",
    description: "",
    createdBy: "",
    rateLimitPerMinute: DEFAULT_RATE_LIMIT.toString(),
    metadataJson: "",
  });
  const [creating, setCreating] = useState(false);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [secretModal, setSecretModal] = useState<SecretState | null>(null);

  useEffect(() => {
    const loadKeys = async () => {
      try {
        const response = await fetch("/api/admin/api-keys");
        if (!response.ok) {
          throw new Error("Unable to load API keys");
        }
        const data = await response.json();
        setKeys(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load API keys");
      } finally {
        setLoading(false);
      }
    };

    loadKeys();
  }, []);

  const activeKeys = useMemo(
    () => keys.filter((key) => key.status === "active"),
    [keys]
  );
  const revokedKeys = useMemo(
    () => keys.filter((key) => key.status === "revoked"),
    [keys]
  );

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const metadata = formState.metadataJson.trim()
        ? JSON.parse(formState.metadataJson)
        : null;

      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim() || null,
        createdBy: formState.createdBy.trim() || null,
        rateLimitPerMinute: Number.parseInt(formState.rateLimitPerMinute, 10),
        metadata,
      };

      if (!payload.name) {
        throw new Error("Name is required");
      }

      if (
        !Number.isFinite(payload.rateLimitPerMinute) ||
        payload.rateLimitPerMinute <= 0
      ) {
        throw new Error("Rate limit must be a positive integer");
      }

      const response = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ error: "Unable to create API key" }));
        throw new Error(body.error || "Unable to create API key");
      }

      const { key, secret } = await response.json();
      setKeys((prev) => [key, ...prev]);
      setSecretModal({
        label: `New API key: ${key.name}`,
        secret,
        key,
      });

      setFormState({
        name: "",
        description: "",
        createdBy: "",
        rateLimitPerMinute: DEFAULT_RATE_LIMIT.toString(),
        metadataJson: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleRotate = async (id: string, name: string) => {
    setRotatingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/api-keys/${id}/rotate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedBy: "dashboard" }),
      });

      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ error: "Unable to rotate key" }));
        throw new Error(body.error || "Unable to rotate key");
      }

      const { key, secret } = await response.json();
      setKeys((prev) =>
        prev.map((existing) => (existing.id === key.id ? key : existing))
      );
      setSecretModal({ label: `Rotated key: ${name}`, secret, key });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rotate key");
    } finally {
      setRotatingId(null);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/api-keys/${id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Revoked from dashboard" }),
      });

      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ error: "Unable to revoke key" }));
        throw new Error(body.error || "Unable to revoke key");
      }

      const { key } = await response.json();
      setKeys((prev) =>
        prev.map((existing) => (existing.id === key.id ? key : existing))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to revoke key");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">External API keys</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Issue and manage API keys for downstream consumers. Keys are hashed at rest
          and subject to per-minute rate limits enforced by middleware.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/10 text-destructive">
          <CardHeader>
            <CardTitle className="text-base">An error occurred</CardTitle>
            <CardDescription className="text-destructive/80">
              {error}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create a key</CardTitle>
          <CardDescription>
            Provide a name and optional metadata to generate a new key. The secret is
            shown once—store it securely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Analytics partner"
                value={formState.name}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, name: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="createdBy">Owner</Label>
              <Input
                id="createdBy"
                placeholder="ops@company.com"
                value={formState.createdBy}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, createdBy: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the intended usage to keep the audit trail clear."
                value={formState.description}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rateLimit">Rate limit (per minute)</Label>
              <Input
                id="rateLimit"
                type="number"
                min={1}
                value={formState.rateLimitPerMinute}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, rateLimitPerMinute: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metadata">Metadata (JSON)</Label>
              <Textarea
                id="metadata"
                placeholder='{"environment":"production"}'
                value={formState.metadataJson}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, metadataJson: event.target.value }))
                }
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Generate key"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active keys</CardTitle>
            <CardDescription>{activeKeys.length} active keys</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : activeKeys.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active keys.</p>
            ) : (
              activeKeys.map((key) => (
                <div
                  key={key.id}
                  className="rounded-lg border border-border/60 p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(key.createdAt) ?? "Created recently"}
                      </p>
                    </div>
                    <Badge variant="outline">••••{key.lastFour}</Badge>
                  </div>
                  {key.description && (
                    <p className="text-sm text-muted-foreground">{key.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>Rate: {key.rateLimitPerMinute}/min</span>
                    {formatRelativeTime(key.lastUsedAt) && (
                      <span>Last used {formatRelativeTime(key.lastUsedAt)}</span>
                    )}
                    {formatRelativeTime(key.rotatedAt) && (
                      <span>Rotated {formatRelativeTime(key.rotatedAt)}</span>
                    )}
                    {key.metadata && Object.keys(key.metadata).length > 0 && (
                      <span>
                        Metadata:
                        {" "}
                        {Object.entries(key.metadata)
                          .map(([k, v]) => `${k}=${String(v)}`)
                          .join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRotate(key.id, key.name)}
                      disabled={rotatingId === key.id}
                    >
                      {rotatingId === key.id ? "Rotating…" : "Rotate"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRevoke(key.id)}
                      disabled={revokingId === key.id}
                    >
                      {revokingId === key.id ? "Revoking…" : "Revoke"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revoked keys</CardTitle>
            <CardDescription>{revokedKeys.length} revoked keys</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : revokedKeys.length === 0 ? (
              <p className="text-muted-foreground text-sm">No revoked keys.</p>
            ) : (
              revokedKeys.map((key) => (
                <div key={key.id} className="rounded-lg border border-border/60 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(key.updatedAt) ?? "Revoked"}
                      </p>
                    </div>
                    <Badge variant="secondary">Revoked</Badge>
                  </div>
                  {key.description && (
                    <p className="text-sm text-muted-foreground mt-2">{key.description}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(secretModal)}
        onOpenChange={(open) => !open && setSecretModal(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{secretModal?.label}</DialogTitle>
            <DialogDescription>
              Copy this value now—it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {secretModal && (
            <div className="rounded-md bg-muted p-4 font-mono text-sm break-all">
              {secretModal.secret}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
