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
