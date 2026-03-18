import { API_CONFIG } from '@/config/api';
import { apiPost } from './api';

const BASE = API_CONFIG.BASE_URL;

const isTimeoutError = (msg: string) =>
  /timeout|timed out|read timeout/i.test(msg);

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const generateArchitecturePrompt = async (pageContents: string[]): Promise<string> => {
  const response = await apiPost(`${BASE}/api/design/generate-prompt`, {
    page_contents: pageContents,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || 'Failed to generate architecture prompt');
  }

  const data = await response.json();
  return data.prompt || '';
};

export const generateDrawioXML = async (prompt: string, maxRetries = 2): Promise<string> => {
  let lastError = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await apiPost(`${BASE}/api/design/generate-xml`, { prompt });

    if (response.ok) {
      const data = await response.json();
      return data.xml || '';
    }

    const err = await response.json().catch(() => ({ detail: response.statusText }));
    lastError = err.detail || 'Failed to generate draw.io XML';

    // Retry only on timeout errors and if attempts remain
    if (isTimeoutError(lastError) && attempt < maxRetries) {
      await delay(2000 * attempt);
      continue;
    }

    break;
  }

  throw new Error(lastError);
};
