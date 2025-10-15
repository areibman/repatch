import { ApiKeysManager } from "@/components/api-keys/ApiKeysManager";
import { fetchApiKeys } from "./actions";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const keys = await fetchApiKeys();

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">External API keys</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Issue API keys for partners that need read-only access to patch note
          data. Keys can be rotated or revoked at any time, and rate limits help
          prevent abuse.
        </p>
      </div>
      <ApiKeysManager keys={keys} />
    </div>
  );
}
