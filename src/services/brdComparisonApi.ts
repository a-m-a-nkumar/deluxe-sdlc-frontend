import { apiRequest } from "./api";
import { API_CONFIG } from "@/config/api";

export type ChangeType = "ADD" | "MODIFY" | "REMOVE";

export interface Suggestion {
  id: string;
  change_type: ChangeType;
  section: string;
  current_text: string | null;
  proposed_text: string | null;
  reason: string;
}

export interface CompareResponse {
  brd_page_id: string;
  brd_title: string;
  code_summary_page_id: string;
  code_summary_title: string;
  suggestions: Suggestion[];
}

export interface ApplyResponse {
  page_id: string;
  title: string;
  web_url: string;
  version: number;
  applied: number;
}

/**
 * Ask the backend to diff a code summary against a BRD and return
 * structured ADD / MODIFY / REMOVE suggestions for review.
 */
export async function compareBrdWithCodeSummary(
  projectId: string,
  codeSummaryPageId: string,
  brdPageId: string,
): Promise<CompareResponse> {
  const url = `${API_CONFIG.BASE_URL}/api/brd-sync/compare`;
  const resp = await apiRequest(url, {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      code_summary_page_id: codeSummaryPageId,
      brd_page_id: brdPageId,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Comparison failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

/**
 * Apply the human-approved subset of suggestions: backend regenerates the
 * merged BRD and overwrites the Confluence page.
 */
export async function applyApprovedChanges(
  projectId: string,
  codeSummaryPageId: string,
  brdPageId: string,
  approvedSuggestions: Suggestion[],
): Promise<ApplyResponse> {
  const url = `${API_CONFIG.BASE_URL}/api/brd-sync/apply`;
  const resp = await apiRequest(url, {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      code_summary_page_id: codeSummaryPageId,
      brd_page_id: brdPageId,
      approved_suggestions: approvedSuggestions,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Apply failed (${resp.status}): ${text}`);
  }
  return resp.json();
}
