/**
 * Lucidchart API client.
 *
 * Companion to the Draw.io flow — this is the second authoring path in the
 * Diagram phase. The user picks Confluence pages + a diagram type, the
 * backend asks Claude to produce a structured architecture brief, then the
 * user authorises Lucid via OAuth and triggers `create-lucid-mcp` which
 * calls Lucid AI's MCP tool to materialise the diagram and returns a
 * Lucidchart edit URL.
 */

import { API_CONFIG } from "@/config/api";
import { apiGet, apiPost } from "./api";

const BASE = API_CONFIG.BASE_URL;

export interface GenerateLucidPromptRequest {
  project_id: string;
  page_contents: string[];
  diagram_type?: string;
}

export const generateLucidPrompt = async (req: GenerateLucidPromptRequest): Promise<string> => {
  const response = await apiPost(`${BASE}/api/design/generate-lucid-prompt`, {
    project_id: req.project_id,
    page_contents: req.page_contents,
    diagram_type: req.diagram_type ?? "infrastructure",
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || "Failed to generate architecture description");
  }

  const data = await response.json();
  return data.prompt || "";
};

export const generateLucidPromptStream = async (
  req: GenerateLucidPromptRequest,
  onChunk: (text: string) => void,
): Promise<void> => {
  const response = await apiPost(`${BASE}/api/design/generate-lucid-prompt-stream`, {
    project_id: req.project_id,
    page_contents: req.page_contents,
    diagram_type: req.diagram_type ?? "infrastructure",
  });

  if (!response.ok || !response.body) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || "Failed to generate architecture description");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === "chunk") onChunk(data.text);
        else if (data.type === "error") throw new Error(data.message);
      } catch {
        /* skip malformed */
      }
    }
  }
};

// ─── Lucid OAuth helpers ────────────────────────────────────────────────────

export const getLucidAuthUrl = async (): Promise<string> => {
  const response = await apiGet(`${BASE}/api/design/lucid-auth-url`);
  if (!response.ok) throw new Error("Failed to get Lucid auth URL");
  const data = await response.json();
  return data.url;
};

export const getLucidStatus = async (): Promise<boolean> => {
  const response = await apiGet(`${BASE}/api/design/lucid-status`);
  if (!response.ok) return false;
  const data = await response.json();
  return data.connected;
};

// ─── MCP-based diagram creation ─────────────────────────────────────────────

export interface CreateLucidMcpRequest {
  prompt: string;
  title: string;
}

export interface CreateLucidMcpResponse {
  edit_url: string;
  document_id: string;
  raw?: string;
}

export const createLucidViaMcp = async (
  req: CreateLucidMcpRequest,
): Promise<CreateLucidMcpResponse> => {
  const response = await apiPost(`${BASE}/api/design/create-lucid-mcp`, {
    prompt: req.prompt,
    title: req.title,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || "Failed to create diagram via Lucid AI");
  }
  return response.json();
};


// =============================================================================
// Personal-API-key import flow (Plate 04 in LucidDashboard)
// =============================================================================
// After the user generates a diagram in lucid.app, these endpoints let us
// pull it back into the platform: list their recent docs, then fetch the
// chosen one as SVG and persist it to the session's diagram slot so the SAD
// generator embeds it like a drawio diagram.

export interface LucidDocumentSummary {
  document_id: string;
  title: string;
  last_modified?: string | null;
}

export interface ListLucidDocumentsResponse {
  documents: LucidDocumentSummary[];
  suggested_search: string | null;
}

export const listLucidDocuments = async (
  search?: string,
  suggest?: string,
): Promise<ListLucidDocumentsResponse> => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (suggest) params.set("suggest", suggest);
  const url = params.toString()
    ? `${BASE}/api/design/lucid/documents?${params}`
    : `${BASE}/api/design/lucid/documents`;
  const response = await apiGet(url);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || "Failed to list Lucid documents");
  }
  return response.json();
};

export interface ImportLucidRequest {
  session_id: string;
  document_id: string;
  diagram_type: "logical" | "infrastructure" | "security";
  document_title?: string;
}

export interface ImportLucidResponse {
  artifact_key: string;
  diagram_type: "logical" | "infrastructure" | "security";
  preview_url: string;
  saved_at: number;
  document_id: string;
  document_title?: string | null;
}

export const importLucidDocument = async (
  req: ImportLucidRequest,
): Promise<ImportLucidResponse> => {
  const response = await apiPost(`${BASE}/api/design/lucid/import`, req);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || "Failed to import Lucid document");
  }
  return response.json();
};

/** Returns a URL the <img> or <object> tag can hit directly.
 *  Note: the backend preview endpoint requires Bearer auth, which <img src>
 *  cannot carry. Prefer `fetchLucidPreviewBlobUrl` for in-app previews. */
export const lucidPreviewUrl = (
  sessionId: string,
  diagramType: "logical" | "infrastructure" | "security",
): string => `${BASE}/api/design/lucid/preview/${sessionId}/${diagramType}`;

/** Fetch the saved Lucid SVG with the Azure AD bearer token, wrap as a Blob,
 *  and return an object URL the caller can pass to <img src>. The caller is
 *  responsible for revoking the URL via URL.revokeObjectURL on unmount /
 *  re-fetch to avoid leaking the in-memory blob.
 *
 *  Mirrors the SAD viewer's `fetchSadDiagramBlobUrl` pattern in sadApi.ts. */
export const fetchLucidPreviewBlobUrl = async (
  token: string,
  sessionId: string,
  diagramType: "logical" | "infrastructure" | "security",
): Promise<string> => {
  const response = await fetch(
    `${BASE}/api/design/lucid/preview/${encodeURIComponent(sessionId)}/${encodeURIComponent(diagramType)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    throw new Error(`Lucid preview failed: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
