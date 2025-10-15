import fs from 'node:fs';
import path from 'node:path';
import { getFixturesDir, usingMockIntegrations } from '@/lib/testing/test-environment';

const cache = new Map<string, any>();

export function loadIntegrationFixture<T>(name: string, fallback: T): T {
  if (!usingMockIntegrations()) {
    return fallback;
  }

  const fixturesDir = getFixturesDir();
  const filePath = path.join(fixturesDir, `${name}.json`);

  if (!fs.existsSync(filePath)) {
    console.warn(`Integration fixture not found: ${filePath}`);
    return fallback;
  }

  if (cache.has(filePath)) {
    return cache.get(filePath) as T;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    cache.set(filePath, parsed);
    return parsed as T;
  } catch (error) {
    console.error(`Failed to parse fixture ${filePath}`, error);
    return fallback;
  }
}

export function clearIntegrationFixtureCache() {
  cache.clear();
}
