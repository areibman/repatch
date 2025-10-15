import { queueThread } from '@/lib/typefully';

describe('typefully helper', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, MOCK_TYPEFULLY: '1' };
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns ok in mock/dry-run mode without API key', async () => {
    const result = await queueThread({ text: 'hello world' });
    expect(result.ok).toBe(true);
    expect(result.threadId).toBeDefined();
  });
});
