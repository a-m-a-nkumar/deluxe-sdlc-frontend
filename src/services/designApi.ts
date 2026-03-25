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

export const generateArchitecturePromptStream = async (
  pageContents: string[],
  onChunk: (text: string) => void,
): Promise<void> => {
  const response = await apiPost(`${BASE}/api/design/generate-prompt-stream`, {
    page_contents: pageContents,
  });
  if (!response.ok || !response.body) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || 'Failed to generate architecture prompt');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'chunk') onChunk(data.text);
        else if (data.type === 'error') throw new Error(data.message);
      } catch { /* skip malformed */ }
    }
  }
};

export const generateArchitectureDocumentStream = async (
  xml: string,
  prompt: string,
  onChunk: (text: string) => void,
): Promise<void> => {
  const response = await apiPost(`${BASE}/api/design/generate-document-stream`, { xml, prompt });
  if (!response.ok || !response.body) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || 'Failed to generate architecture document');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'chunk') onChunk(data.text);
        else if (data.type === 'error') throw new Error(data.message);
      } catch { /* skip malformed */ }
    }
  }
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

export const generateArchitectureDocument = async (
  xml: string,
  prompt: string,
): Promise<string> => {
  const response = await apiPost(`${BASE}/api/design/generate-document`, { xml, prompt });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || 'Failed to generate architecture document');
  }

  const data = await response.json();
  return data.document || '';
};

export const pushDocumentToConfluence = async (
  projectId: string,
  spaceKey: string,
  title: string,
  document: string,
): Promise<{ page_url: string; page_id: string }> => {
  const response = await apiPost(`${BASE}/api/design/push-to-confluence`, {
    project_id: projectId,
    space_key: spaceKey,
    title,
    document,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || 'Failed to push to Confluence');
  }

  return response.json();
};

export interface DiagramPageInfo {
  page_id: string;
  title: string;
  page_url: string;
  last_modified: string;
}

export const listSavedDiagrams = async (
  projectId: string,
  spaceKey: string,
): Promise<DiagramPageInfo[]> => {
  const response = await apiPost(`${BASE}/api/design/list-diagrams`, {
    project_id: projectId,
    space_key: spaceKey,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || 'Failed to list diagrams');
  }

  const data = await response.json();
  return data.diagrams ?? [];
};

export const saveDiagramToConfluence = async (
  projectId: string,
  spaceKey: string,
  xml: string,
  pageTitle?: string,
): Promise<{ page_url: string; page_id: string }> => {
  const response = await apiPost(`${BASE}/api/design/save-diagram`, {
    project_id: projectId,
    space_key: spaceKey,
    xml,
    page_title: pageTitle ?? '',
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || 'Failed to save diagram to Confluence');
  }

  return response.json();
};

export const loadDiagramFromConfluence = async (
  projectId: string,
  spaceKey: string,
  pageTitle?: string,
  pageId?: string,
): Promise<{ xml: string; page_url: string; page_id: string } | null> => {
  const response = await apiPost(`${BASE}/api/design/load-diagram`, {
    project_id: projectId,
    space_key: spaceKey,
    page_title: pageTitle ?? '',
    page_id: pageId ?? '',
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || 'Failed to load diagram from Confluence');
  }

  return response.json();
};

