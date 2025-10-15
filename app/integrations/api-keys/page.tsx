import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { toApiKeySummary } from '@/lib/api-keys/common';
import { ApiKeyManager, type ApiKeySummary } from './ApiKeyManager';

export default async function ApiKeysPage() {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[integrations/api-keys] Failed to load API keys', error);
    }

    const initialKeys: ApiKeySummary[] = (data ?? []).map(toApiKeySummary);

    return (
      <div className="container mx-auto px-4 py-8">
        <ApiKeyManager initialKeys={initialKeys} />
      </div>
    );
  } catch (error) {
    console.error('[integrations/api-keys] Unable to render page', error);
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-md border border-dashed border-destructive bg-destructive/5 p-6 text-sm">
          <p className="font-medium text-destructive">Supabase service role not configured.</p>
          <p className="text-muted-foreground mt-2">
            Set <code>SUPABASE_SERVICE_ROLE_KEY</code> in the environment to manage API keys.
          </p>
        </div>
      </div>
    );
  }
}
