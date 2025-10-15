'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ApiKey } from '@/lib/api-keys';
import { isApiKeyActive } from '@/lib/api-keys';
import {
  createApiKeyAction,
  revokeApiKeyAction,
  rotateApiKeyAction,
} from './actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type TokenReveal = {
  token: string;
  keyName: string;
};

type FormState = {
  name: string;
  description: string;
  metadata: string;
  expiresAt: string;
};

type Props = {
  initialKeys: ApiKey[];
};

export default function ApiKeyManager({ initialKeys }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [form, setForm] = useState<FormState>({
    name: '',
    description: '',
    metadata: '',
    expiresAt: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [tokenReveal, setTokenReveal] = useState<TokenReveal | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedKeys = useMemo(() => {
    return [...keys].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [keys]);

  async function handleCreate() {
    setError(null);
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    startTransition(async () => {
      try {
        const result = await createApiKeyAction({
          name: form.name.trim(),
          description: form.description.trim() || null,
          metadata: form.metadata.trim() || null,
          expiresAt: form.expiresAt.trim() || null,
        });

        setKeys((prev) => [result.key, ...prev]);
        setTokenReveal({ token: result.token, keyName: result.key.name });
        setForm({ name: '', description: '', metadata: '', expiresAt: '' });
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'Failed to create API key.'
        );
      }
    });
  }

  function getStatus(
    key: ApiKey
  ): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
    if (key.revokedAt) {
      return { label: 'Revoked', variant: 'destructive' };
    }

    if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()) {
      return { label: 'Expired', variant: 'secondary' };
    }

    return { label: 'Active', variant: 'default' };
  }

  async function handleRotate(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        const current = keys.find((key) => key.id === id);
        const result = await rotateApiKeyAction({
          id,
          expiresAt: current?.expiresAt ?? null,
        });

        setKeys((prev) =>
          prev.map((key) => (key.id === id ? result.key : key))
        );
        setTokenReveal({ token: result.token, keyName: result.key.name });
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'Failed to rotate API key.'
        );
      }
    });
  }

  async function handleRevoke(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        const revoked = await revokeApiKeyAction(id);
        setKeys((prev) =>
          prev.map((key) => (key.id === id ? revoked : key))
        );
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'Failed to revoke API key.'
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create a key</CardTitle>
          <CardDescription>
            API keys are shown only once. Store them in your credential
            manager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                placeholder="Docs sync"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key-expires">Expires at</Label>
              <Input
                id="api-key-expires"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, expiresAt: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-key-description">Description</Label>
            <Input
              id="api-key-description"
              placeholder="Used by docs pipeline"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-key-metadata">Metadata (JSON)</Label>
            <Textarea
              id="api-key-metadata"
              placeholder='{ "owner": "docs-service" }'
              value={form.metadata}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, metadata: event.target.value }))
              }
              rows={4}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <p className="text-xs text-muted-foreground">
            Default rate limit: 60 requests per minute per key.
          </p>
          <Button onClick={handleCreate} disabled={isPending}>
            {isPending ? 'Creating…' : 'Create API key'}
          </Button>
        </CardFooter>
      </Card>

      <div className="grid gap-4">
        {sortedKeys.map((key) => {
          const status = getStatus(key);
          const isActive = isApiKeyActive(key);
          return (
            <Card key={key.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base">{key.name}</CardTitle>
                  <CardDescription>
                    Prefix <span className="font-mono">{key.tokenPrefix}</span>
                  </CardDescription>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {key.description && <p>{key.description}</p>}
                <div className="grid gap-2 sm:grid-cols-3">
                  <InfoRow label="Created">
                    {new Date(key.createdAt).toLocaleString()}
                  </InfoRow>
                  <InfoRow label="Last used">
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleString()
                      : 'Never'}
                  </InfoRow>
                  <InfoRow label="Expires">
                    {key.expiresAt
                      ? new Date(key.expiresAt).toLocaleString()
                      : 'Never'}
                  </InfoRow>
                </div>
                {Object.keys(key.metadata ?? {}).length > 0 && (
                  <div className="rounded-md bg-muted p-3 text-xs">
                    <div className="font-medium">Metadata</div>
                    <pre className="mt-1 whitespace-pre-wrap break-words">
                      {JSON.stringify(key.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => handleRotate(key.id)}
                  disabled={isPending}
                >
                  Rotate key
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleRevoke(key.id)}
                  disabled={isPending || !isActive}
                >
                  Revoke
                </Button>
              </CardFooter>
            </Card>
          );
        })}
        {sortedKeys.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No API keys yet. Create one to get started.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={tokenReveal !== null} onOpenChange={() => setTokenReveal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your API key</DialogTitle>
            <DialogDescription>
              This token is only shown once. Save it to a secure secret
              manager.
            </DialogDescription>
          </DialogHeader>
          {tokenReveal && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{tokenReveal.keyName}</p>
              <code className="block rounded-md bg-muted p-3 text-sm break-all">
                {tokenReveal.token}
              </code>
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setTokenReveal(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type InfoRowProps = {
  label: string;
  children: React.ReactNode;
};

function InfoRow({ label, children }: InfoRowProps) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <div className="font-medium text-sm">{children}</div>
    </div>
  );
}
