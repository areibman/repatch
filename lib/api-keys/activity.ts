import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function recordApiKeyUsage(apiKeyId: string) {
  try {
    const supabase = createServiceRoleClient();
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyId);
  } catch (error) {
    console.error('[api-keys] Failed to record API key usage', error);
  }
}
