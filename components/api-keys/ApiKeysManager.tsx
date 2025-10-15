"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ApiKeyFormState,
  createApiKeyAction,
  revokeApiKeyAction,
  rotateApiKeyAction,
} from "@/app/api-keys/actions";
import type { PublicApiKey } from "@/lib/api-keys/service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

function formatDate(value: string | null) {
  if (!value) return "Never";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusBadge(revokedAt: string | null) {
  if (revokedAt) {
    return <Badge variant="destructive">Revoked</Badge>;
  }
  return <Badge variant="secondary">Active</Badge>;
}

type ApiKeysManagerProps = {
  keys: PublicApiKey[];
};

export function ApiKeysManager({ keys }: ApiKeysManagerProps) {
  const router = useRouter();
  const [state, formAction] = useActionState<ApiKeyFormState, FormData>(
    createApiKeyAction,
    { ok: false }
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [rateLimit, setRateLimit] = useState("60");
  const [token, setToken] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (state.ok && state.token) {
      setToken(state.token);
      setFeedback("New API key created. Copy it now—this is the only time it will be shown.");
      setError(null);
      setName("");
      setDescription("");
      setCreatedBy("");
      setRateLimit("60");
      router.refresh();
    } else if (!state.ok && state.error) {
      setError(state.error);
    }
  }, [state, router]);

  const activeKeys = useMemo(() => keys, [keys]);

  const handleRotate = (id: string) => {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const result = await rotateApiKeyAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setToken(result.token || null);
      setFeedback("API key rotated. Use the new token immediately.");
      router.refresh();
    });
  };

  const handleRevoke = (id: string) => {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const result = await revokeApiKeyAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setToken(null);
      setFeedback("API key revoked.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Create a new API key</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={formAction}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Production client"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Owner / Contact</label>
              <Input
                name="createdBy"
                value={createdBy}
                onChange={(event) => setCreatedBy(event.target.value)}
                placeholder="team@example.com"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                name="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Notes about where this key is used"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rate limit (requests/minute)</label>
              <Input
                name="rateLimitPerMinute"
                value={rateLimit}
                onChange={(event) => setRateLimit(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                min={1}
              />
            </div>
            <div className="flex items-end">
              <CreateKeyButton />
            </div>
          </form>
          {token && (
            <div className="mt-4 rounded-md border border-primary/40 bg-primary/5 p-4">
              <p className="text-sm font-medium text-primary">Generated API key</p>
              <code className="mt-2 block break-all text-sm">{token}</code>
            </div>
          )}
          {feedback && (
            <p className="mt-4 text-sm text-muted-foreground">{feedback}</p>
          )}
          {error && (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Issued keys</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Prefix</th>
                  <th className="py-2 pr-4">Rate limit</th>
                  <th className="py-2 pr-4">Last used</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activeKeys.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      No API keys issued yet.
                    </td>
                  </tr>
                ) : (
                  activeKeys.map((key) => (
                    <tr key={key.id} className="align-top">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-foreground">{key.name}</div>
                        {key.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {key.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">{key.prefix}</td>
                      <td className="py-3 pr-4">{key.rate_limit_per_minute} / min</td>
                      <td className="py-3 pr-4">{formatDate(key.last_used_at)}</td>
                      <td className="py-3 pr-4">{statusBadge(key.revoked_at)}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRotate(key.id)}
                            disabled={isPending}
                          >
                            Rotate
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRevoke(key.id)}
                            disabled={isPending || Boolean(key.revoked_at)}
                          >
                            Revoke
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateKeyButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating..." : "Create key"}
    </Button>
  );
}
