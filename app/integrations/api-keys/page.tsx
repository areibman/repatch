import { listApiKeys } from '@/lib/api-keys';
import ApiKeyManager from './ApiKeyManager';

export const metadata = {
  title: 'External API Keys',
};

export default async function ApiKeysPage() {
  const keys = await listApiKeys();

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">External API</h1>
        <p className="text-muted-foreground text-sm">
          Create, rotate, and revoke API keys used to access the read-only
          external endpoints.
        </p>
      </div>
      <ApiKeyManager initialKeys={keys} />
    </div>
  );
}
