import { randomBytes, createHash } from 'crypto';
import {
  API_KEY_PREFIX,
  API_KEY_VISIBLE_PREFIX_LENGTH,
  type ApiKeyRow,
  type ApiKeySummary,
  getApiKeyStatus,
  toApiKeySummary,
} from './common';

export function generateApiKeyToken() {
  const raw = randomBytes(32).toString('hex');
  const token = `${API_KEY_PREFIX}${raw}`;
  const tokenPrefix = token.slice(0, API_KEY_PREFIX.length + API_KEY_VISIBLE_PREFIX_LENGTH);
  const tokenLastFour = token.slice(-4);
  const hashedToken = createHash('sha256').update(token).digest('hex');

  return { token, tokenPrefix, tokenLastFour, hashedToken };
}

export {
  ApiKeyRow,
  ApiKeySummary,
  getApiKeyStatus,
  toApiKeySummary,
  API_KEY_PREFIX,
  API_KEY_VISIBLE_PREFIX_LENGTH,
} from './common';
