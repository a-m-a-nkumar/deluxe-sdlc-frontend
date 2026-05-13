import { apiGet } from "./api";
import { API_CONFIG } from "@/config/api";

export interface CodeSummaryPage {
  page_id: string;
  title: string;
  web_url: string;
  created: string | null;
  last_modified: string | null;
  version: number;
  labels: string[];
}

export interface ConfluencePageDetail {
  id: string;
  title: string;
  body?: { storage?: { value?: string } };
  version?: { number: number };
}

/**
 * List Confluence pages tagged with a label (newest first).
 * Backed by GET /api/integrations/confluence/pages-by-label.
 */
export async function fetchPagesByLabel(
  spaceKey: string,
  label: string = "code-summary",
  limit: number = 50,
): Promise<CodeSummaryPage[]> {
  const params = new URLSearchParams({ space_key: spaceKey, label, limit: String(limit) });
  const url = `${API_CONFIG.BASE_URL}/api/integrations/confluence/pages-by-label?${params}`;
  const resp = await apiGet(url);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to load pages by label (${resp.status}): ${text}`);
  }
  const data = await resp.json();
  return data.results || [];
}

/**
 * Fetch a single Confluence page's full content (incl. body.storage HTML).
 * Backed by GET /api/integrations/confluence/pages/{page_id}.
 */
export async function fetchConfluencePage(pageId: string): Promise<ConfluencePageDetail> {
  const url = `${API_CONFIG.BASE_URL}/api/integrations/confluence/pages/${encodeURIComponent(pageId)}`;
  const resp = await apiGet(url);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to load Confluence page (${resp.status}): ${text}`);
  }
  return resp.json();
}
