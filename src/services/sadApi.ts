/**
 * SAD-phase API client.
 *
 * The SAD phase is scoped by `session_id` (a `design_session.id`). All
 * heavy work (intent routing, section drafting, audit, edit) is delegated
 * to the backend → SAD orchestrator Lambda. The frontend only renders the
 * resulting card payloads and the section JSON the backend persists.
 */

import { API_CONFIG } from "@/config/api";
import { apiGet, apiPost } from "./api";

const BASE = `${API_CONFIG.BASE_URL}/api/sad`;

// ---- Card response shape returned by /turn ----

export type SADCardType =
  | "text"
  | "fact_saved"
  | "doc_ingested"
  | "section_view"
  | "section_updated"
  | "section_regenerated"
  | "audit"
  | "suggestions"
  | "generation_starting"
  | "generation_progress"
  | "generation_complete";

export interface SADCard<T = Record<string, unknown>> {
  type: SADCardType | string;
  payload: T;
}

// ---- Strongly-typed payloads for the cards we render with custom UI ----

export interface FactSavedPayload {
  fact_id: string;
  text: string;
  suggested_section: number | null;
  regen_proposed: boolean;
  follow_up?: string;
}

export interface DocIngestedPayload {
  fact_id: string;
  filename: string;
  suggested_section: number | null;
}

export interface SectionViewPayload {
  n: number;
  title: string;
  content: SADContentBlock[];
}

export interface SectionUpdatedPayload {
  n: number;
  title: string;
  content: SADContentBlock[];
}

export interface AuditPayload {
  badges: AuditBadge[];
  details: AuditDetail[];
}

export interface AuditBadge {
  n: number;
  title: string;
  score: number;
  icon: string;
}

export interface AuditDetail {
  n: number;
  title: string;
  issues: AuditIssue[];
}

export interface AuditIssue {
  code: string;
  msg: string;
}

export interface SuggestionsPayload {
  n: number;
  title: string;
  items: SuggestionItem[];
}

export interface SuggestionItem {
  title: string;
  rationale: string;
  apply_intent: "EDIT_SECTION" | "REGENERATE_SECTION" | string;
  edit_instruction: string;
}

// ---- Section / SAD shapes (mirror sad_structure.json) ----

export type SADContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "bullet_list"; items: string[] }
  | { type: "ordered_list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "diagram"; s3_key: string; alt: string };

export interface SADSection {
  number: number;
  title: string;
  content: SADContentBlock[];
  status?: "auto_drafted" | "user_edited" | "regenerated" | "flagged";
  audit?: { score: number; issues: AuditIssue[] };
  previous_versions?: SADContentBlock[][];
  last_modified_ts?: number;
}

export interface SADSectionsList {
  sad_id: string;
  stage: string;
  sections: Pick<SADSection, "number" | "title" | "status" | "audit" | "last_modified_ts">[];
}

// ---- Turn (chat box) ----

export interface SADTurnArgs {
  session_id: string;
  message: string;
  project_id?: string | null;
  viewing_section?: number | null;
  last_card_type?: string | null;
  last_proposed_section?: number | null;
  file?: File | null;
}

/**
 * One chat-box turn. Returns an array of cards — usually one, but can
 * be many when the user pastes multiple Confluence URLs (each becomes
 * its own `doc_ingested` card, plus zero-or-more synthetic warning
 * `text` cards from the backend for tenant mismatches / fetch failures).
 *
 * The wire response is always `{cards: [...]}`. Older deployments may
 * still return the legacy `{type, payload}` shape — we tolerate both
 * and normalise to an array here so callers always iterate.
 */
export async function sadTurn(args: SADTurnArgs): Promise<SADCard[]> {
  const fd = new FormData();
  fd.append("session_id", args.session_id);
  fd.append("message", args.message ?? "");
  if (args.project_id) fd.append("project_id", args.project_id);
  if (args.viewing_section != null) fd.append("viewing_section", String(args.viewing_section));
  if (args.last_card_type) fd.append("last_card_type", args.last_card_type);
  if (args.last_proposed_section != null)
    fd.append("last_proposed_section", String(args.last_proposed_section));
  if (args.file) fd.append("file", args.file);
  const r = await apiPost(`${BASE}/turn`, fd);
  if (!r.ok) throw new Error(`sadTurn failed: ${r.status}`);
  const body = await r.json();
  if (body && Array.isArray(body.cards)) {
    return body.cards as SADCard[];
  }
  // Legacy single-card response.
  if (body && typeof body === "object" && "type" in body) {
    return [body as SADCard];
  }
  return [];
}

// ---- Generate / audit / revert ----

export async function sadGenerate(sessionId: string, projectId?: string, brdId?: string) {
  const r = await apiPost(`${BASE}/generate`, {
    session_id: sessionId,
    project_id: projectId,
    brd_id: brdId,
  });
  if (!r.ok) throw new Error(`sadGenerate failed: ${r.status}`);
  return r.json() as Promise<{ sad_id: string; sections_completed: number; duration_s: number }>;
}

export async function sadAudit(
  sessionId: string,
  projectId?: string,
  sectionNumber?: number,
): Promise<AuditPayload> {
  const r = await apiPost(`${BASE}/audit`, {
    session_id: sessionId,
    project_id: projectId,
    section_number: sectionNumber,
  });
  if (!r.ok) throw new Error(`sadAudit failed: ${r.status}`);
  return r.json();
}

/**
 * Persist user-edited section content directly. No LLM involvement —
 * the user has typed the exact content blocks they want. Backend pushes
 * the previous content onto `previous_versions` so Revert still works
 * to undo this manual edit.
 */
export async function saveSadSection(
  sessionId: string,
  sectionNumber: number,
  content: SADContentBlock[],
): Promise<SADSection> {
  const r = await apiPost(`${BASE}/save-section`, {
    session_id: sessionId,
    section_number: sectionNumber,
    content,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || `saveSadSection failed: ${r.status}`);
  }
  return r.json();
}

export async function sadRevertSection(sessionId: string, sectionNumber: number) {
  const r = await apiPost(`${BASE}/revert-section`, {
    session_id: sessionId,
    section_number: sectionNumber,
  });
  if (!r.ok) throw new Error(`sadRevertSection failed: ${r.status}`);
  return r.json() as Promise<{ reverted: boolean; n?: number; content?: SADContentBlock[]; error?: string }>;
}

// ---- Reads ----

export async function getSadSections(sessionId: string): Promise<SADSectionsList> {
  const r = await apiGet(`${BASE}/${encodeURIComponent(sessionId)}/sections`);
  if (!r.ok) throw new Error(`getSadSections failed: ${r.status}`);
  return r.json();
}

export async function getSadSection(sessionId: string, n: number): Promise<SADSection> {
  const r = await apiGet(`${BASE}/${encodeURIComponent(sessionId)}/section/${n}`);
  if (!r.ok) throw new Error(`getSadSection failed: ${r.status}`);
  return r.json();
}

export function getSadDiagramURL(sessionId: string, kind: "logical" | "security" | "infrastructure" = "logical") {
  return `${BASE}/${encodeURIComponent(sessionId)}/diagram/${kind}`;
}

export async function getSadFacts(sessionId: string): Promise<{ sad_id: string; facts: any[] }> {
  const r = await apiGet(`${BASE}/${encodeURIComponent(sessionId)}/facts`);
  if (!r.ok) throw new Error(`getSadFacts failed: ${r.status}`);
  return r.json();
}

/**
 * Fetch the embedded diagram SVG with auth and return a blob URL the caller
 * can set as `<img src>`. Same auth-header reason as the DOCX download —
 * the browser won't attach the bearer token to a plain `<img>` request,
 * so we fetch ourselves and blob the bytes.
 *
 * Caller is responsible for revoking the URL with URL.revokeObjectURL when
 * the image is unmounted.
 */
export async function fetchSadDiagramBlobUrl(
  sessionId: string,
  kind: "logical" | "security" | "infrastructure" = "logical",
): Promise<string> {
  const r = await apiGet(
    `${BASE}/${encodeURIComponent(sessionId)}/diagram/${encodeURIComponent(kind)}`,
  );
  if (!r.ok) {
    throw new Error(`Diagram fetch failed: ${r.status} ${r.statusText}`);
  }
  const blob = await r.blob();
  return URL.createObjectURL(blob);
}

/**
 * Download the SAD as a DOCX with the architecture diagram embedded.
 *
 * Two-step flow:
 *   1. Pre-render the saved diagram XML into a PNG via the draw.io hidden
 *      iframe and POST it to /api/design/save-diagram. The DOCX endpoint
 *      will then pick up sessions/{id}/diagram/logical.png and embed
 *      directly (no cairosvg conversion). Best-effort — if the render
 *      fails, the DOCX gets a placeholder for the diagram instead.
 *   2. GET /api/sad/download-sad/{id} to fetch the DOCX bytes. We can't
 *      use a plain <a href> because the endpoint requires the auth header
 *      the browser doesn't attach to link clicks — so we fetch ourselves,
 *      blob the bytes, and trigger a hidden anchor download.
 *
 * Caller can pass `projectId` to enable the pre-render step. If omitted
 * we skip step 1 and just fetch the DOCX (will use whatever PNG/SVG is
 * already in S3, or fall back to placeholder).
 */
export async function downloadSadDocx(
  sessionId: string,
  filename?: string,
  projectId?: string,
): Promise<void> {
  if (projectId) {
    try {
      const { saveDiagramToSession, loadDiagramForSession } = await import("./designApi");
      const { exportPngFromVisibleIframe, exportDrawioXmlAsPng } = await import("./sadDiagramExport");

      let png: string | null = null;

      // Path 1 (preferred): the SAD page already has a draw.io viewer
      // iframe rendering the diagram. Just ask THAT iframe to export PNG.
      // It's already loaded and rendered, so this completes near-instantly.
      try {
        png = await exportPngFromVisibleIframe();
      } catch (e) {
        console.warn(
          "[SAD] visible-iframe PNG export failed; falling back to fresh hidden iframe",
          e,
        );
      }

      // Path 2 (fallback): no visible iframe, or it didn't respond.
      // Spawn a fresh hidden iframe, load the saved XML, export. Slower
      // and more fragile (this is the path that's been hanging on slow
      // networks), but it's all we have if the viewer isn't on screen.
      if (!png) {
        const loaded = await loadDiagramForSession(projectId, sessionId);
        const xml = loaded?.xml;
        if (xml && xml.trim()) {
          try {
            png = await exportDrawioXmlAsPng(xml);
          } catch (e) {
            console.warn("[SAD] hidden-iframe PNG pre-render failed", e);
          }
        }
      }

      if (png) {
        await saveDiagramToSession({ projectId, sessionId, png });
        console.log("[SAD] DOCX pre-render: PNG saved → backend will embed");
      } else {
        console.warn(
          "[SAD] DOCX pre-render: no PNG could be produced; DOCX will use SVG fallback or placeholder",
        );
      }
    } catch (e) {
      console.warn("[SAD] DOCX pre-render step failed; falling back to whatever's in S3", e);
    }
  }
  await fetchAndDownloadDocx(sessionId, filename);
}

async function fetchAndDownloadDocx(sessionId: string, filename?: string): Promise<void> {
  const r = await apiGet(`${BASE}/download-sad/${encodeURIComponent(sessionId)}`);
  if (!r.ok) {
    throw new Error(`Download failed: ${r.status} ${r.statusText}`);
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `SAD_${sessionId}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
