export function getIntegrationMode(): 'live' | 'mock' {
  const mode = process.env.REPATCH_INTEGRATION_MODE?.toLowerCase();
  return mode === 'mock' ? 'mock' : 'live';
}

export function getSupabaseMode(): 'live' | 'mock' {
  const mode = process.env.REPATCH_SUPABASE_MODE?.toLowerCase();
  return mode === 'mock' ? 'mock' : 'live';
}

export function usingMockIntegrations() {
  return getIntegrationMode() === 'mock';
}

export function usingMockSupabase() {
  return getSupabaseMode() === 'mock';
}

export function getFixturesDir() {
  return (
    process.env.REPATCH_FIXTURES_DIR ||
    new URL('../../tests/fixtures/', import.meta.url).pathname
  );
}
