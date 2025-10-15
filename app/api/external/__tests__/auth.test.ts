import { describe, expect, it } from '@jest/globals';
import {
  ApiKey,
  ApiKeyRepository,
  hashToken,
  validateApiKey,
} from '@/lib/api-keys';

describe('validateApiKey', () => {
  const activeKey: ApiKey = {
    id: '1',
    name: 'Active',
    tokenPrefix: 'rk_active',
    description: null,
    metadata: {},
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const revokedKey: ApiKey = {
    ...activeKey,
    id: '2',
    name: 'Revoked',
    tokenPrefix: 'rk_revoked',
    revokedAt: new Date().toISOString(),
  };

  const expiredKey: ApiKey = {
    ...activeKey,
    id: '3',
    name: 'Expired',
    tokenPrefix: 'rk_expired',
    expiresAt: new Date(Date.now() - 1_000).toISOString(),
  };

  const mockRepo = new InMemoryRepository({
    'valid-token': activeKey,
    'revoked-token': revokedKey,
    'expired-token': expiredKey,
  });

  it('returns the key when token is valid', async () => {
    const result = await validateApiKey('valid-token', mockRepo);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.key.id).toBe('1');
      expect(mockRepo.touchedIds).toContain('1');
    }
  });

  it('rejects missing token', async () => {
    const result = await validateApiKey('missing-token', mockRepo);
    expect(result).toEqual({
      valid: false,
      status: 401,
      message: 'Invalid API key',
    });
  });

  it('rejects revoked keys', async () => {
    const result = await validateApiKey('revoked-token', mockRepo);
    expect(result).toEqual({
      valid: false,
      status: 403,
      message: 'API key has been revoked',
    });
  });

  it('rejects expired keys', async () => {
    const result = await validateApiKey('expired-token', mockRepo);
    expect(result).toEqual({
      valid: false,
      status: 403,
      message: 'API key has expired',
    });
  });
});

class InMemoryRepository implements ApiKeyRepository {
  private readonly store: Record<string, ApiKey>;
  touchedIds: string[] = [];

  constructor(map: Record<string, ApiKey>) {
    this.store = Object.entries(map).reduce((acc, [token, key]) => {
      acc[hashToken(token)] = key;
      return acc;
    }, {} as Record<string, ApiKey>);
  }

  async create() {
    throw new Error('not implemented');
  }

  async list() {
    return Object.values(this.store);
  }

  async rotate() {
    throw new Error('not implemented');
  }

  async revoke() {
    throw new Error('not implemented');
  }

  async findByHashedToken(hash: string) {
    return this.store[hash] ?? null;
  }

  async touch(id: string) {
    this.touchedIds.push(id);
  }
}
