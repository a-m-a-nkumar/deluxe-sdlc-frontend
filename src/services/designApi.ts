import { API_CONFIG } from '@/config/api';
import { apiPost } from './api';

const BASE = API_CONFIG.BASE_URL;

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

export const generateDrawioXML = async (prompt: string): Promise<string> => {
  const response = await apiPost(`${BASE}/api/design/generate-xml`, {
    prompt,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || 'Failed to generate draw.io XML');
  }

  const data = await response.json();
  return data.xml || '';
};
